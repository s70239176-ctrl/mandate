"""v3: last look at execution, reason codes, keeper fees, proposer track records, prompt transparency."""
import json

import pytest

from conftest import (
    APPEAL_BOND, BOND, MAX_UNAVAILABLE, NOW0, RETRY_GAP, SCAN_GAP, SEED, SUNFIELD, WATCH_PAGE, WATCH_URL, WINDOW,
    PROPOSAL_EXPIRY, Refused, contract_module, hexof, verdict,
)


def conserved(world):
    assert world.deposited == world.total_paid() + world.held()


def approved(world, **kw):
    fid = world.create(**kw.pop("fund", {}))
    pid = world.propose(fid, **kw)
    assert world.resolve(pid) == "approved"
    return fid, pid


# ------------------------------------------------------------ reason codes
class TestReasonCodes:
    @pytest.mark.parametrize(
        "llm,reason,ek,ak",
        [
            (verdict(excluded=True, excluded_kind="labor"), "excluded_labor", "labor", "none"),
            (verdict(excluded=True, excluded_kind="safety"), "excluded_safety", "safety", "none"),
            (verdict(excluded=True), "excluded_other", "other", "none"),  # a missing kind collapses to other
            (verdict(excluded=True, excluded_kind="nonsense"), "excluded_other", "other", "none"),
            (verdict(in_theme=False), "off_theme", "none", "none"),
            (verdict(adverse=True, adverse_kind="insolvency"), "adverse_insolvency", "none", "insolvency"),
            (verdict(adverse=True, adverse_kind="none"), "adverse_other", "none", "other"),
            (verdict(evidence=False, in_theme=False), "insufficient_evidence", "none", "none"),
        ],
    )
    def test_every_rejection_says_why(self, world, llm, reason, ek, ak):
        fid = world.create()
        pid = world.propose(fid)
        assert world.resolve(pid, llm) == "rejected"
        p = world.c.get_proposal(pid)
        assert (p["reason"], p["excluded_kind"], p["adverse_kind"]) == (reason, ek, ak)

    def test_a_kind_without_its_boolean_is_ignored(self, world):
        fid = world.create()
        pid = world.propose(fid)
        assert world.resolve(pid, verdict(excluded=False, excluded_kind="labor", adverse_kind="fraud")) == "approved"
        p = world.c.get_proposal(pid)
        assert (p["excluded_kind"], p["adverse_kind"], p["reason"]) == ("none", "none", "")

    def test_evidence_and_appeal_and_expiry_reasons(self, world):
        from conftest import appeal_verdict

        fid = world.create()
        a = world.propose(fid)
        world.pages[SUNFIELD] += " edited"
        world.resolve(a)
        assert world.c.get_proposal(a)["reason"] == "evidence_changed"
        fid2, b = approved(world, target="windco")
        world.appeal(b)
        world.resolve_appeal(b, appeal_verdict())
        assert world.c.get_proposal(b)["reason"] == "appeal_upheld"

    def test_kinds_are_checked_for_consistency_but_never_compared(self, world):
        m = contract_module()
        base = {"evidence_available": True, "in_theme": True, "excluded": True, "adverse": False, "source": "ok"}
        a = m.normalize_full({**base, "kinds": {"excluded_kind": "labor", "adverse_kind": "none"}})
        b = m.normalize_full({**base, "kinds": {"excluded_kind": "safety", "adverse_kind": "none"}})
        assert a != b and m.core_of(a) == m.core_of(b)  # validators who disagree on the kind still agree
        assert m.normalize_full({**base, "kinds": {"excluded_kind": "labor"}}) is None
        assert m.normalize_full({**base}) is None
        # the leader cannot smuggle a kind for a false boolean: normalization rewrites it
        off = m.normalize_full({**base, "excluded": False, "kinds": {"excluded_kind": "labor", "adverse_kind": "none"}})
        assert off["kinds"]["excluded_kind"] == "none"


# ------------------------------------------------------------ last look
class TestLastLook:
    def test_a_clear_last_look_executes_as_before(self, world):
        fid, pid = approved(world)
        world.at(WINDOW)
        assert world.execute(pid) == "executed"
        p = world.c.get_proposal(pid)
        assert p["status"] == "EXECUTED" and p["lastlook_state"] == "clear"
        assert world.paid_to(world.payee_a) == 8000
        prompt = world.llm_prompts[-1]
        assert "MANDATE_LASTLOOK" in prompt and "UNTRUSTED DATA" in prompt and "LIVE n=1" in prompt
        conserved(world)

    def test_the_last_look_reads_the_live_page_not_the_committed_one(self, world):
        fid, pid = approved(world)
        world.pages[SUNFIELD] = "Sunfield Solar: Q3 update, revenue up again, plant expansion on schedule."
        world.at(WINDOW)
        world.requests.clear()
        assert world.execute(pid) == "executed"  # a changed but harmless page does not block
        assert SUNFIELD in world.requests
        assert "Q3 update" in world.llm_prompts[-1]

    @pytest.mark.parametrize(
        "look,reason",
        [
            ({"excluded": True, "adverse": False, "excluded_kind": "labor"}, "last_look_excluded_labor"),
            ({"excluded": False, "adverse": True, "adverse_kind": "fraud"}, "last_look_adverse_fraud"),
            ({"excluded": True, "adverse": False}, "last_look_excluded_other"),
        ],
    )
    def test_news_after_approval_blocks_the_trade_and_costs_the_proposer_nothing(self, world, look, reason):
        fid, pid = approved(world)
        world.at(WINDOW)
        assert world.execute(pid, lastlook=look) == "blocked"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["note"], p["reason"], p["lastlook_state"]) == ("REJECTED", "last_look_blocked", reason, "flagged")
        assert p["bond_outcome"] == "RETURNED" and world.paid_to(world.bob) == BOND
        assert world.paid_to(world.payee_a) == 0
        f = world.c.get_fund(fid)
        assert f["reserved"] == 0 and f["allocated"] == 0 and f["pool"] == SEED
        with world.vm.expect_revert("not approved"):
            world.execute(pid)
        conserved(world)

    def test_unreadable_evidence_fails_closed_after_bounded_retries(self, world):
        fid, pid = approved(world)
        world.at(WINDOW)
        world.pages[SUNFIELD] = None
        assert world.execute(pid) == "unavailable"
        with world.vm.expect_revert("retry too soon"):
            world.execute(pid)
        world.at(WINDOW + RETRY_GAP)
        assert world.execute(pid) == "unavailable"
        world.at(WINDOW + 2 * RETRY_GAP)
        assert world.execute(pid) == "blocked"
        p = world.c.get_proposal(pid)
        assert (p["status"], p["reason"], p["bond_outcome"]) == ("REJECTED", "last_look_unavailable", "RETURNED")
        assert world.paid_to(world.payee_a) == 0
        conserved(world)

    def test_a_short_outage_is_free(self, world):
        fid, pid = approved(world)
        world.at(WINDOW)
        world.pages[SUNFIELD] = None
        assert world.execute(pid) == "unavailable"
        world.pages[SUNFIELD] = "back"
        world.at(WINDOW + RETRY_GAP)
        assert world.execute(pid) == "executed"

    @pytest.mark.parametrize("bad", ["not json", json.dumps({"excluded": True}), json.dumps({"excluded": "yes", "adverse": False})])
    def test_garbage_moves_nothing_and_the_proposal_stays_approved(self, world, bad):
        fid, pid = approved(world)
        world.at(WINDOW)
        with world.vm.expect_revert("bad judgment"):
            world.execute(pid, lastlook=bad)
        assert world.c.get_proposal(pid)["status"] == "APPROVED"
        assert world.paid_to(world.payee_a) == 0

    def test_a_frozen_target_is_refused_before_the_model_is_asked(self, world):
        world.pages["https://news.example.org/energy-watch"] = WATCH_PAGE
        fid, pid = approved(world, fund={"watch": [WATCH_URL]})
        world.scan(fid, ["sunfield solar"])
        world.at(WINDOW)
        before = len(world.llm_prompts)
        with world.vm.expect_revert("target frozen"):
            world.execute(pid)
        assert not any("MANDATE_LASTLOOK" in p for p in world.llm_prompts[before:])

    def test_normalize_lastlook(self, world):
        m = contract_module()
        ok = {"excluded": True, "adverse": False, "source": "ok", "kinds": {"excluded_kind": "safety", "adverse_kind": "none"}}
        assert m.normalize_lastlook(ok) == ok
        gone = m.normalize_lastlook({**ok, "source": "unavailable"})
        assert (gone["excluded"], gone["adverse"], gone["kinds"]["excluded_kind"]) == (False, False, "none")
        assert m.normalize_lastlook({**ok, "source": "changed"}) is None
        assert m.normalize_lastlook({"excluded": True, "source": "ok", "kinds": {}}) is None


# ------------------------------------------------------------ keeper fees
class TestKeeperFees:
    FEE = 10

    def fund(self, world, **kw):
        world.pages[WATCH_URL] = WATCH_PAGE
        return world.create(keeper=self.FEE, watch=[WATCH_URL], **kw)

    def test_the_fee_is_bounded_and_frozen(self, world):
        with pytest.raises(Refused) as e:
            world.create(keeper=SEED // 100 + 1)
        assert str(e.value) == "bad keeper fee"
        fid = self.fund(world)
        assert world.c.get_fund(fid)["keeper_fee"] == self.FEE

    def test_whoever_settles_a_step_is_paid_from_the_idle_pool(self, world):
        fid = self.fund(world)
        pid = world.propose(fid)
        world.resolve(pid)  # charlie settles the jury round
        assert world.paid_to(world.charlie) == self.FEE
        world.at(WINDOW)
        world.execute(pid)
        assert world.paid_to(world.charlie) == 2 * self.FEE
        assert world.c.get_fund(fid)["pool"] == SEED - 8000 - 2 * self.FEE
        world.at(SCAN_GAP + WINDOW)
        world.scan(fid)
        assert world.paid_to(world.charlie) == 3 * self.FEE
        conserved(world)

    def test_rejections_appeals_and_expiry_pay_the_keeper_too(self, world):
        from conftest import appeal_verdict

        fid = self.fund(world)
        a = world.propose(fid, target="windco", urls=["https://news.example.org/windco-offshore-farm"], pages=["WindCo builds turbines."], payee=world.payee_b)
        world.resolve(a, verdict(in_theme=False))  # rejected: bond slashed to the pool, keeper paid from idle
        assert world.paid_to(world.charlie) == self.FEE
        b = world.propose(fid, sender=world.alice, payee=world.payee_a)
        world.resolve(b)
        world.appeal(b, sender=world.alice)
        world.resolve_appeal(b, appeal_verdict(substantiated=False))
        assert world.paid_to(world.charlie) == 3 * self.FEE  # approve + dismissed appeal
        c = world.propose(fid, target="hydro", urls=["https://news.example.org/hydro"], pages=["Hydro."], payee=world.payee_b, sender=world.charlie)
        world.at(PROPOSAL_EXPIRY)
        world.vm.sender = world.alice
        world.c.expire_proposal(c)
        assert world.paid_to(world.alice) >= self.FEE
        conserved(world)

    def test_the_keeper_is_never_paid_from_earmarked_gms(self, world):
        fid = world.create(seed=10000, single=10000, trade=10000, keeper=100)
        pid = world.propose(fid, amount=10000)  # earmarks everything
        world.resolve(pid)
        assert world.paid_to(world.charlie) == 0  # nothing is free, so no fee, and the settlement still happens
        assert world.c.get_proposal(pid)["status"] == "APPROVED"
        conserved(world)

    def test_no_fee_without_a_settled_step(self, world):
        fid = self.fund(world)
        pid = world.propose(fid)
        world.pages[SUNFIELD] = None
        assert world.resolve(pid) == "unavailable"
        assert world.paid_to(world.charlie) == 0

    def test_a_zero_fee_pays_nothing_extra(self, world):
        fid = world.create()
        pid = world.propose(fid)
        world.resolve(pid)
        assert world.paid_to(world.charlie) == 0


# ------------------------------------------------------------ track records
class TestTrackRecords:
    def test_counts_follow_each_outcome(self, world):
        from conftest import appeal_verdict

        fid = world.create()
        ok = world.propose(fid, sender=world.bob)
        world.resolve(ok)
        world.at(WINDOW)
        world.execute(ok)
        bad = world.propose(fid, target="windco", urls=["https://news.example.org/w"], pages=["WindCo."], payee=world.payee_b, sender=world.bob)
        world.resolve(bad, verdict(in_theme=False))
        row = world.c.get_proposer(hexof(world.bob))
        assert (row["approved"], row["rejected"], row["executed"], row["overturned"]) == (1, 1, 1, 0)

    def test_an_upheld_appeal_is_recorded_as_overturned(self, world):
        from conftest import appeal_verdict

        fid, pid = approved(world)
        world.appeal(pid)
        world.resolve_appeal(pid, appeal_verdict())
        row = world.c.get_proposer(hexof(world.bob))
        assert (row["approved"], row["overturned"], row["executed"]) == (1, 1, 0)

    def test_the_leaderboard_ranks_by_executions(self, world):
        fid = world.create(single=10000, trade=1000)
        a = world.propose(fid, target="one", urls=["https://news.example.org/1"], pages=["a"], sender=world.bob, amount=100)
        b = world.propose(fid, target="two", urls=["https://news.example.org/2"], pages=["b"], sender=world.charlie, amount=100, payee=world.payee_b)
        world.resolve(a)
        world.resolve(b)
        world.at(WINDOW)
        world.execute(b)
        board = world.c.list_proposers(10)
        assert board["total"] == 2 and board["items"][0]["address"] == hexof(world.charlie)
        assert board["items"][0]["executed"] == 1

    def test_unknown_addresses_have_an_empty_record(self, world):
        row = world.c.get_proposer("0x" + "11" * 20)
        assert (row["approved"], row["rejected"], row["executed"], row["overturned"]) == (0, 0, 0, 0)


# ------------------------------------------------------------ transparency
class TestPrompts:
    def test_the_exact_instructions_are_public(self, world):
        prompts = world.c.get_prompts()
        assert "MANDATE_JUDGE" in prompts["proposal"] and "UNTRUSTED DATA" in prompts["proposal"]
        assert "MANDATE_APPEAL" in prompts["appeal"] and "MANDATE_LASTLOOK" in prompts["last_look"] and "MANDATE_SCAN" in prompts["scan"]
        assert "Concentration and trade size are enforced by the contract" in prompts["proposal"]
        assert len(prompts["deterministic_rules"]) >= 4
