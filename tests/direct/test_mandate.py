"""Mandate Direct Mode tests: caps, evidence commitments, the settlement table, appeals, execution, redemption."""
import json

import pytest

from conftest import (
    APPEAL_BOND, APPEAL_PAGE, APPEAL_URL, BOND, DAY, ENDS, HOUR, INJECT_PAGE, MANDATE, MAX_UNAVAILABLE, NOW0,
    PROPOSAL_EXPIRY, RETRY_GAP, SEED, SINGLE_BPS, SUNFIELD, SUNFIELD2, SUNFIELD2_PAGE, SUNFIELD_PAGE, TRADE_BPS,
    WINDCO, WINDCO_PAGE, WINDOW, Refused, appeal_verdict, contract_module, hexof, verdict,
)


def conserved(world):
    """Every GEN ever attached is either paid out or still accounted for inside the contract."""
    assert world.deposited == world.total_paid() + world.held()


def approved(world, **kw):
    """Fund + one approved proposal; returns (fund_id, proposal_id)."""
    fid = world.create()
    pid = world.propose(fid, **kw)
    assert world.resolve(pid) == "approved"
    return fid, pid


# ------------------------------------------------------------ pure rules
class TestPureRules:
    def test_caps(self, world):
        m = contract_module()
        ok = lambda **o: m.check_caps(**{**dict(total_stake=100000, free=100000, position=0, reserved_target=0,
                                               amount=10000, max_trade_bps=1000, max_single_bps=2000), **o})
        assert ok() is None
        assert ok(amount=0) == "bad amount"
        assert ok(amount=10001) == "trade too large"
        assert ok(position=10001) == "concentration cap"
        assert ok(position=5000, reserved_target=5000) is None
        assert ok(position=5000, reserved_target=5001) == "concentration cap"
        assert ok(free=9999) == "insufficient idle balance"

    def test_redeem_is_pro_rata(self, world):
        m = contract_module()
        assert m.redeem_amount(25, 80, 100, 0) == 20
        assert m.redeem_amount(25, 60, 100, 25) == 20  # first member took 20 of 80; the rest keep their share
        assert m.redeem_amount(0, 80, 100, 0) == 0

    @pytest.mark.parametrize(
        "fields,expected",
        [
            (verdict(), (True, "HELD")),
            (verdict(excluded=True), (False, "SLASHED")),
            (verdict(in_theme=False), (False, "SLASHED")),
            (verdict(adverse=True), (False, "RETURNED")),
            (verdict(evidence=False, in_theme=False), (False, "RETURNED")),
        ],
    )
    def test_settlement_table(self, world, fields, expected):
        m = contract_module()
        assert m.decide(m.normalize_judgment(fields)) == expected

    def test_normalization_rejects_malformed(self, world):
        m = contract_module()
        assert m.normalize_judgment({"evidence_available": True}) is None
        assert m.normalize_judgment({**verdict(), "in_theme": "yes"}) is None
        assert m.normalize_judgment({**verdict(), "extra": 1}) is None
        assert m.normalize_judgment(verdict(evidence=False, excluded=True, adverse=True)) == verdict(
            evidence=False, in_theme=False)


# ------------------------------------------------------------ fund creation
class TestCreate:
    def test_fund_freezes_mandate_and_caps(self, world):
        fid = world.create()
        f = world.c.get_fund(fid)
        assert (f["mandate"], f["max_single_bps"], f["max_trade_bps"]) == (MANDATE, SINGLE_BPS, TRADE_BPS)
        assert (f["pool"], f["free"], f["total_stake"], f["members"]) == (SEED, SEED, SEED, 1)
        assert (f["max_single"], f["max_trade"]) == (20000, 10000)
        assert world.c.get_stake(fid, hexof(world.alice)) == SEED
        conserved(world)

    def test_params_are_fixed_at_deployment(self, world):
        p = world.c.get_params()
        assert (p["retry_gap"], p["max_unavailable"], p["proposal_expiry"]) == (RETRY_GAP, MAX_UNAVAILABLE, PROPOSAL_EXPIRY)

    @pytest.mark.parametrize(
        "overrides,seed,message",
        [
            ({}, 0, "empty seed"),
            ({"name": ""}, SEED, "bad name"),
            ({"mandate": "  "}, SEED, "bad mandate"),
            ({"mandate": "x" * 4001}, SEED, "bad mandate"),
            ({"single": 99}, SEED, "bad single cap"),
            ({"single": 10001}, SEED, "bad single cap"),
            ({"trade": 9}, SEED, "bad trade cap"),
            ({"trade": 2001}, SEED, "bad trade cap"),
            ({"bond": 0}, SEED, "bad bond"),
            ({"appeal_bond": 0}, SEED, "bad bond"),
            ({"window": 59}, SEED, "bad window"),
            ({"window": 8 * DAY}, SEED, "bad window"),
            ({"ends": NOW0 + WINDOW}, SEED, "bad end"),
            ({"ends": NOW0 + 366 * DAY}, SEED, "bad end"),
        ],
    )
    def test_invalid_funds_are_refused_with_a_refund(self, world, overrides, seed, message):
        with pytest.raises(Refused) as e:
            world.create(seed=seed, **overrides)
        assert str(e.value) == message
        assert world.paid_to(world.alice) == seed
        conserved(world)

    def test_contribute_adds_stake_and_members(self, world):
        fid = world.create()
        world.contribute(fid, world.bob, 50000)
        world.contribute(fid, world.bob, 1000)
        f = world.c.get_fund(fid)
        assert (f["total_stake"], f["pool"], f["members"]) == (SEED + 51000, SEED + 51000, 2)
        assert world.c.get_stake(fid, hexof(world.bob)) == 51000
        conserved(world)

    def test_contribute_refused_when_closed_or_unknown(self, world):
        fid = world.create()
        world.at(ENDS - WINDOW)
        with pytest.raises(Refused) as e:
            world.contribute(fid, world.bob, 10)
        assert str(e.value) == "fund closed"
        with pytest.raises(Refused):
            world.contribute(99, world.bob, 10)
        conserved(world)


# ------------------------------------------------------------ proposing
class TestPropose:
    def test_proposal_reserves_and_commits(self, world):
        fid = world.create()
        pid = world.propose(fid)
        p = world.c.get_proposal(pid)
        assert p["status"] == "PENDING" and p["amount"] == 8000 and p["urls"] == [SUNFIELD]
        assert p["hashes"] == [world.hash_of(SUNFIELD_PAGE)]
        assert p["in_theme"] is None and p["excluded"] is None  # nothing shown before a verdict
        f = world.c.get_fund(fid)
        assert (f["reserved"], f["free"], f["pool"]) == (8000, SEED - 8000, SEED)
        assert f["positions"][0]["reserved"] == 8000 and f["positions"][0]["allocated"] == 0
        conserved(world)

    @pytest.mark.parametrize(
        "kw,reason",
        [
            ({"amount": 0}, "bad amount"),
            ({"amount": 10001}, "trade too large"),
            ({"value": BOND + 1}, "bond mismatch"),
            ({"value": BOND - 1}, "bond mismatch"),
            ({"target": ""}, "bad target"),
            ({"target": "Bad Caps"}, "bad target"),
            ({"thesis": "  "}, "bad thesis"),
            ({"thesis": "x" * 1201}, "bad thesis"),
            ({"urls": ["http://news.example.org/a"]}, "bad url"),
            ({"urls": ["https://localhost/a"]}, "bad url"),
            ({"urls": [SUNFIELD, SUNFIELD]}, "bad evidence"),
            ({"hashes": ["abc"]}, "bad hash"),
            ({"hashes": ["A" * 64]}, "bad hash"),
            ({"hashes": [("a" * 64), ("b" * 64)]}, "bad evidence"),
            ({"sender": "alice-self"}, "proposer cannot be payee"),
            ({"payee": "0x1234"}, "bad payee"),
        ],
    )
    def test_invalid_proposals_are_refused_with_a_refund(self, world, kw, reason):
        fid = world.create()
        if kw.get("sender") == "alice-self":
            kw = {"sender": world.alice, "payee": world.alice}
        who = kw.get("sender", world.bob)
        before = world.paid_to(who)
        with pytest.raises(Refused) as e:
            world.propose(fid, **kw)
        assert str(e.value) == reason
        assert world.paid_to(who) - before == kw.get("value", BOND)
        assert world.c.get_fund(fid)["reserved"] == 0
        conserved(world)

    def test_too_many_urls(self, world):
        fid = world.create()
        urls = [f"https://news.example.org/a{i}" for i in range(4)]
        with pytest.raises(Refused) as e:
            world.propose(fid, urls=urls, pages=["p"] * 4)
        assert str(e.value) == "bad evidence"

    def test_concentration_cap_counts_open_proposals(self, world):
        fid = world.create()
        world.propose(fid, amount=10000)
        world.propose(fid, amount=10000, sender=world.charlie)
        with pytest.raises(Refused) as e:
            world.propose(fid, amount=1, sender=world.alice)
        assert str(e.value) == "concentration cap"  # 20,000 already earmarked for this name
        world.propose(fid, target="windco", urls=[WINDCO], pages=[WINDCO_PAGE], payee=world.payee_b, amount=1, sender=world.alice)
        conserved(world)

    def test_one_name_has_one_payee(self, world):
        fid = world.create()
        world.propose(fid, amount=1000)
        with pytest.raises(Refused) as e:
            world.propose(fid, amount=1000, payee=world.payee_b, sender=world.charlie)
        assert str(e.value) == "payee mismatch"

    def test_idle_balance_bounds_proposals(self, world):
        fid = world.create(seed=12000, single=10000, trade=10000)
        world.propose(fid, amount=12000)
        with pytest.raises(Refused) as e:
            world.propose(fid, target="windco", urls=[WINDCO], pages=[WINDCO_PAGE], payee=world.payee_b, amount=1, sender=world.charlie)
        assert str(e.value) == "insufficient idle balance"

    def test_open_proposals_per_proposer_are_bounded(self, world):
        fid = world.create(single=10000, trade=1000)
        for i in range(3):
            world.propose(fid, target=f"name {i}", urls=[f"https://news.example.org/n{i}"], amount=100)
        with pytest.raises(Refused) as e:
            world.propose(fid, target="name 9", urls=["https://news.example.org/n9"], amount=100)
        assert str(e.value) == "too many open"

    def test_cannot_propose_when_the_window_would_outlive_the_fund(self, world):
        fid = world.create()
        world.at(ENDS - WINDOW)
        with pytest.raises(Refused) as e:
            world.propose(fid)
        assert str(e.value) == "fund closed"


# ------------------------------------------------------------ the jury
class TestResolve:
    def test_approved_starts_the_window(self, world):
        fid, pid = approved(world)
        p = world.c.get_proposal(pid)
        assert p["status"] == "APPROVED" and p["executable_at"] == NOW0 + WINDOW
        assert (p["in_theme"], p["excluded"], p["adverse"]) == (True, False, False)
        assert world.c.get_fund(fid)["reserved"] == 8000  # still earmarked until it executes
        conserved(world)

    def test_every_evidence_page_is_judged(self, world):
        fid = world.create()
        pid = world.propose(fid, urls=[SUNFIELD, SUNFIELD2], pages=[SUNFIELD_PAGE, SUNFIELD2_PAGE])
        assert world.resolve(pid) == "approved"
        prompt = world.llm_prompts[-1]
        assert SUNFIELD_PAGE in prompt and SUNFIELD2_PAGE in prompt and MANDATE in prompt

    @pytest.mark.parametrize(
        "llm,bond,note",
        [
            (verdict(excluded=True), "SLASHED", "mandate_violation"),
            (verdict(in_theme=False), "SLASHED", "mandate_violation"),
            (verdict(adverse=True), "RETURNED", "adverse_event"),
            (verdict(evidence=False, in_theme=False), "RETURNED", "mandate_violation"),
        ],
    )
    def test_rejections_release_the_earmark_and_settle_the_bond(self, world, llm, bond, note):
        fid = world.create()
        pid = world.propose(fid)
        assert world.resolve(pid, llm) == "rejected"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["bond_outcome"]) == ("REJECTED", bond)
        f = world.c.get_fund(fid)
        assert f["reserved"] == 0 and f["positions"][0]["reserved"] == 0
        if bond == "SLASHED":
            assert f["pool"] == SEED + BOND and world.paid_to(world.bob) == 0
        else:
            assert f["pool"] == SEED and world.paid_to(world.bob) == BOND
        conserved(world)

    def test_injected_evidence_cannot_buy_an_approval(self, world):
        fid = world.create()
        pid = world.propose(fid, pages=[INJECT_PAGE])
        # an honest validator reads the injection as no evidence at all
        assert world.resolve(pid, verdict(evidence=False, in_theme=False)) == "rejected"
        prompt = world.llm_prompts[-1]
        assert "UNTRUSTED DATA" in prompt and "<<<EVIDENCE n=1" in prompt
        conserved(world)

    def test_a_changed_page_is_rejected_and_slashed_without_asking_the_model(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.pages[SUNFIELD] = SUNFIELD_PAGE + " (edited after commitment)"
        before = len(world.llm_prompts)
        assert world.resolve(pid) == "rejected"
        p = world.c.get_proposal(pid)
        assert (p["evidence_state"], p["note"], p["bond_outcome"]) == ("changed", "evidence_changed", "SLASHED")
        assert len(world.llm_prompts) == before
        conserved(world)

    def test_the_second_page_changing_also_counts(self, world):
        fid = world.create()
        pid = world.propose(fid, urls=[SUNFIELD, SUNFIELD2], pages=[SUNFIELD_PAGE, SUNFIELD2_PAGE])
        world.pages[SUNFIELD2] = "different"
        assert world.resolve(pid) == "rejected"
        assert world.c.get_proposal(pid)["note"] == "evidence_changed"

    def test_unavailable_evidence_is_retried_then_rejected_with_the_bond_returned(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.pages[SUNFIELD] = None
        assert world.resolve(pid) == "unavailable"
        with world.vm.expect_revert("retry too soon"):
            world.resolve(pid)
        world.at(RETRY_GAP)
        assert world.resolve(pid) == "unavailable"
        world.at(2 * RETRY_GAP)
        assert world.resolve(pid) == "rejected"
        p = world.c.get_proposal(pid)
        assert (p["note"], p["bond_outcome"], p["attempts"]) == ("evidence_unavailable", "RETURNED", MAX_UNAVAILABLE)
        assert world.paid_to(world.bob) == BOND and world.c.get_fund(fid)["reserved"] == 0
        conserved(world)

    def test_a_short_outage_is_free(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.pages[SUNFIELD] = None
        assert world.resolve(pid) == "unavailable"
        world.pages[SUNFIELD] = SUNFIELD_PAGE
        world.at(RETRY_GAP)
        assert world.resolve(pid) == "approved"

    @pytest.mark.parametrize("bad", ["not json", json.dumps({"in_theme": True}), json.dumps(verdict(in_theme="yes")), "[]"])
    def test_garbage_from_the_model_moves_nothing(self, world, bad):
        fid = world.create()
        pid = world.propose(fid)
        with world.vm.expect_revert("bad judgment"):
            world.resolve(pid, bad)
        assert world.c.get_proposal(pid)["status"] == "PENDING"
        conserved(world)

    def test_prose_around_the_schema_is_dropped(self, world):
        fid = world.create()
        pid = world.propose(fid)
        assert world.resolve(pid, {**verdict(), "reasoning": "looks fine to me"}) == "approved"

    def test_cannot_resolve_twice_or_after_expiry(self, world):
        fid, pid = approved(world)
        with world.vm.expect_revert("not pending"):
            world.resolve(pid)
        pid2 = world.propose(fid, target="windco", urls=[WINDCO], pages=[WINDCO_PAGE], payee=world.payee_b, amount=1000, sender=world.charlie)
        world.at(PROPOSAL_EXPIRY)
        with world.vm.expect_revert("proposal expired"):
            world.resolve(pid2)


# ------------------------------------------------------------ execution
class TestExecute:
    def test_execution_waits_for_the_window_then_pays_the_payee_and_returns_the_bond(self, world):
        fid, pid = approved(world)
        with world.vm.expect_revert("window open"):
            world.execute(pid)
        world.at(WINDOW)
        assert world.execute(pid) == "executed"
        assert world.paid_to(world.payee_a) == 8000 and world.paid_to(world.bob) == BOND
        f = world.c.get_fund(fid)
        assert (f["pool"], f["reserved"], f["allocated"]) == (SEED - 8000, 0, 8000)
        assert f["positions"][0]["allocated"] == 8000 and f["positions"][0]["reserved"] == 0
        assert world.c.get_proposal(pid)["status"] == "EXECUTED"
        conserved(world)

    def test_cannot_execute_twice_or_before_approval(self, world):
        fid = world.create()
        pid = world.propose(fid)
        with world.vm.expect_revert("not approved"):
            world.execute(pid)
        assert world.resolve(pid) == "approved"
        world.at(WINDOW)
        world.execute(pid)
        with world.vm.expect_revert("not approved"):
            world.execute(pid)
        assert world.paid_to(world.payee_a) == 8000

    def test_the_cap_holds_across_executed_positions(self, world):
        fid = world.create()
        for i, sender in enumerate((world.bob, world.charlie)):
            pid = world.propose(fid, amount=10000, sender=sender)
            world.resolve(pid)
        world.at(WINDOW)
        world.execute(1)
        world.execute(2)
        with pytest.raises(Refused) as e:
            world.propose(fid, amount=1)
        assert str(e.value) == "concentration cap"
        assert world.c.get_fund(fid)["positions"][0]["allocated"] == 20000
        conserved(world)

    def test_an_unexecuted_proposal_expires_and_unblocks_the_fund(self, world):
        fid, pid = approved(world)
        with world.vm.expect_revert("not expired yet"):
            world.vm.sender = world.charlie
            world.c.expire_proposal(pid)
        world.at(PROPOSAL_EXPIRY)
        with world.vm.expect_revert("proposal expired"):
            world.execute(pid)
        world.vm.sender = world.charlie
        assert world.c.expire_proposal(pid) == "expired"
        assert world.paid_to(world.bob) == BOND and world.c.get_fund(fid)["reserved"] == 0
        with world.vm.expect_revert("not open"):
            world.c.expire_proposal(pid)
        conserved(world)

    def test_expiring_a_pending_proposal_after_a_stuck_jury(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.at(PROPOSAL_EXPIRY)
        world.vm.sender = world.charlie
        assert world.c.expire_proposal(pid) == "expired"
        assert world.c.get_proposal(pid)["note"] == "expired"
        conserved(world)


# ------------------------------------------------------------ appeals
class TestAppeal:
    def test_only_members_can_appeal_an_approved_allocation_inside_its_window(self, world):
        fid, pid = approved(world)
        world.vm.sender = world.charlie
        with pytest.raises(Refused) as e:
            world.appeal(pid, sender=world.charlie)
        assert str(e.value) == "members only"
        with pytest.raises(Refused) as e:
            world.appeal(pid, value=APPEAL_BOND + 1)
        assert str(e.value) == "bond mismatch"
        with pytest.raises(Refused) as e:
            world.appeal(pid, url=SUNFIELD, page=SUNFIELD_PAGE)
        assert str(e.value) == "bad url"  # an appeal must bring new evidence
        with pytest.raises(Refused) as e:
            world.appeal(pid, evidence="zz")
        assert str(e.value) == "bad hash"
        world.at(WINDOW)
        with pytest.raises(Refused) as e:
            world.appeal(pid)
        assert str(e.value) == "window closed"
        conserved(world)

    def test_only_approved_proposals_can_be_appealed_and_only_once(self, world):
        fid = world.create()
        pid = world.propose(fid)
        with pytest.raises(Refused) as e:
            world.appeal(pid)
        assert str(e.value) == "not appealable"
        world.resolve(pid)
        world.appeal(pid)
        with pytest.raises(Refused) as e:
            world.appeal(pid)
        assert str(e.value) == "not appealable"
        conserved(world)

    def test_an_appeal_blocks_execution(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        assert world.c.get_proposal(pid)["status"] == "APPEALED"
        world.at(WINDOW + 1)
        with world.vm.expect_revert("not approved"):
            world.execute(pid)
        conserved(world)

    def test_an_upheld_appeal_cancels_the_allocation_and_slashes_the_proposer(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        assert world.resolve_appeal(pid) == "cancelled"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["appeal_state"], p["note"], p["bond_outcome"]) == ("CANCELLED", "UPHELD", "appeal_upheld", "SLASHED")
        f = world.c.get_fund(fid)
        assert f["reserved"] == 0 and f["pool"] == SEED + BOND
        assert world.paid_to(world.alice) == APPEAL_BOND and world.paid_to(world.bob) == 0
        assert "UNTRUSTED DATA" in world.llm_prompts[-1] and APPEAL_PAGE in world.llm_prompts[-1]
        conserved(world)

    def test_a_dismissed_appeal_forfeits_its_bond_and_the_allocation_proceeds(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        assert world.resolve_appeal(pid, appeal_verdict(substantiated=False)) == "dismissed"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["appeal_state"]) == ("APPROVED", "DISMISSED")
        assert world.c.get_fund(fid)["pool"] == SEED + APPEAL_BOND
        world.at(WINDOW)
        assert world.execute(pid) == "executed"
        assert world.paid_to(world.payee_a) == 8000
        conserved(world)

    def test_a_late_resolution_still_waits_no_longer_than_needed(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        world.at(WINDOW + DAY)
        world.resolve_appeal(pid, appeal_verdict(substantiated=False))
        assert world.c.get_proposal(pid)["executable_at"] == NOW0 + WINDOW + DAY
        assert world.execute(pid) == "executed"

    def test_a_vanished_appeal_page_is_dismissed_without_penalty(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        world.pages[APPEAL_URL] = None
        assert world.resolve_appeal(pid) == "unavailable"
        world.at(RETRY_GAP)
        assert world.resolve_appeal(pid) == "unavailable"
        world.at(2 * RETRY_GAP)
        assert world.resolve_appeal(pid) == "dismissed"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["appeal_state"]) == ("APPROVED", "UNAVAILABLE")
        assert world.paid_to(world.alice) == APPEAL_BOND
        conserved(world)

    def test_a_changed_appeal_page_is_dismissed_and_slashed(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        world.pages[APPEAL_URL] = "rewritten"
        before = len(world.llm_prompts)
        assert world.resolve_appeal(pid) == "dismissed"
        assert world.c.get_proposal(pid)["appeal_state"] == "CHANGED"
        assert world.c.get_fund(fid)["pool"] == SEED + APPEAL_BOND and len(world.llm_prompts) == before
        conserved(world)

    def test_garbage_appeal_output_moves_nothing(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        with world.vm.expect_revert("bad judgment"):
            world.resolve_appeal(pid, "nonsense")
        assert world.c.get_proposal(pid)["status"] == "APPEALED"

    def test_a_stuck_appeal_expires_and_returns_both_bonds(self, world):
        fid, pid = approved(world)
        world.appeal(pid)
        world.at(PROPOSAL_EXPIRY)
        world.vm.sender = world.charlie
        assert world.c.expire_proposal(pid) == "expired"
        assert world.paid_to(world.alice) == APPEAL_BOND and world.paid_to(world.bob) == BOND
        assert world.c.get_proposal(pid)["appeal_state"] == "EXPIRED"
        assert world.c.get_fund(fid)["reserved"] == 0
        conserved(world)


# ------------------------------------------------------------ redemption
class TestRedeem:
    def test_nobody_can_redeem_before_the_fund_ends(self, world):
        fid = world.create()
        world.vm.sender = world.alice
        with world.vm.expect_revert("fund still open"):
            world.c.redeem(fid)
        assert world.c.get_redeemable(fid, hexof(world.alice)) == 0

    def test_members_redeem_the_idle_balance_pro_rata_after_allocations(self, world):
        fid = world.create(seed=60000, single=10000, trade=10000)
        world.contribute(fid, world.bob, 20000)
        world.contribute(fid, world.charlie, 20000)
        pid = world.propose(fid, amount=10000, sender=world.bob)
        world.resolve(pid)
        world.at(WINDOW)
        world.execute(pid)
        world.at(ENDS)
        # pool = 90,000 and stakes are 60/20/20 thousand of 100,000
        assert world.c.get_redeemable(fid, hexof(world.alice)) == 54000
        world.vm.sender = world.alice
        assert world.c.redeem(fid) == 54000
        world.vm.sender = world.bob
        assert world.c.redeem(fid) == 18000
        world.vm.sender = world.charlie
        assert world.c.redeem(fid) == 18000
        assert world.paid_to(world.alice) == 54000
        assert world.c.get_fund(fid)["pool"] == 0
        with world.vm.expect_revert("nothing to redeem"):
            world.c.redeem(fid)
        conserved(world)

    def test_redemption_waits_until_no_proposal_is_open(self, world):
        fid = world.create()
        pid = world.propose(fid, amount=10000)
        world.at(ENDS)
        world.vm.sender = world.alice
        with world.vm.expect_revert("proposals still open"):
            world.c.redeem(fid)
        assert world.c.get_redeemable(fid, hexof(world.alice)) == 0
        world.vm.sender = world.charlie
        world.c.expire_proposal(pid)
        world.vm.sender = world.alice
        assert world.c.redeem(fid) == SEED
        assert world.paid_to(world.bob) == BOND
        conserved(world)

    def test_bonds_slashed_into_the_pool_are_shared_by_members(self, world):
        fid = world.create(seed=1000, single=10000, trade=1000, bond=100)
        world.contribute(fid, world.charlie, 1000)
        pid = world.propose(fid, amount=100, value=100)
        world.resolve(pid, verdict(excluded=True))
        world.at(ENDS)
        world.vm.sender = world.alice
        assert world.c.redeem(fid) == 1050
        world.vm.sender = world.charlie
        assert world.c.redeem(fid) == 1050
        conserved(world)


# ------------------------------------------------------------ misc
class TestViews:
    def test_unknown_ids_revert(self, world):
        with world.vm.expect_revert("unknown fund"):
            world.c.get_fund(7)
        with world.vm.expect_revert("unknown proposal"):
            world.c.get_proposal(7)

    def test_listings_are_newest_first_and_filterable(self, world):
        f1 = world.create()
        f2 = world.create(name="Second")
        assert [x["id"] for x in world.c.list_funds(0, 20)["items"]] == [f2, f1]
        p1 = world.propose(f1, sender=world.bob)
        p2 = world.propose(f2, sender=world.charlie)
        assert [x["id"] for x in world.c.list_proposals(0, "", 0, 20)["items"]] == [p2, p1]
        assert [x["id"] for x in world.c.list_proposals(f1, "", 0, 20)["items"]] == [p1]
        assert [x["id"] for x in world.c.list_proposals(0, hexof(world.charlie), 0, 20)["items"]] == [p2]
        assert world.c.list_proposals(0, "", 1, 1)["items"][0]["id"] == p1

    def test_only_the_judge_reads_the_network(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.resolve(pid)
        assert set(world.requests) == {SUNFIELD}
