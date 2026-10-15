"""The standing watch: validators read frozen watch pages against holdings and freeze targets with documented adverse news."""
import json

import pytest

from conftest import (
    DAY, HOUR, NOW0, SCAN_GAP, WATCH_BAD_PAGE, WATCH_PAGE, WATCH_URL, WATCH_URL2, WINDOW, Refused, contract_module,
)


def conserved(world):
    assert world.deposited == world.total_paid() + world.held()


def watched_fund(world, **kw):
    world.pages[WATCH_URL] = WATCH_PAGE
    world.pages[WATCH_URL2] = WATCH_PAGE
    return world.create(watch=[WATCH_URL, WATCH_URL2], **kw)


class TestCreateWithWatch:
    def test_watch_pages_are_frozen_with_the_fund(self, world):
        fid = watched_fund(world)
        f = world.c.get_fund(fid)
        assert f["watch_urls"] == [WATCH_URL, WATCH_URL2] and f["frozen"] == [] and f["scan_count"] == 0
        assert world.c.get_params()["scan_gap"] == SCAN_GAP

    @pytest.mark.parametrize(
        "watch,reason",
        [
            (["http://news.example.org/a"], "bad url"),
            (["https://localhost/a"], "bad url"),
            ([WATCH_URL, WATCH_URL], "bad watch"),
            (["https://a.example.org/1", "https://a.example.org/2", "https://a.example.org/3", "https://a.example.org/4"], "bad watch"),
        ],
    )
    def test_bad_watch_lists_are_refused_with_a_refund(self, world, watch, reason):
        with pytest.raises(Refused) as e:
            world.create(watch=watch)
        assert str(e.value) == reason
        assert world.paid_to(world.alice) > 0
        conserved(world)


class TestScan:
    def test_scan_needs_watch_sources_and_holdings(self, world):
        fid = world.create()
        with world.vm.expect_revert("no watch sources"):
            world.scan(fid)
        fid2 = watched_fund(world)
        with world.vm.expect_revert("nothing to watch"):
            world.scan(fid2)

    def test_a_clear_scan_changes_nothing_but_the_clock(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        assert world.scan(fid) == "clear"
        f = world.c.get_fund(fid)
        assert f["frozen"] == [] and f["scan_count"] == 1 and f["last_scan_at"] == NOW0
        prompt = world.llm_prompts[-1]
        assert "sunfield solar" in prompt and WATCH_PAGE in prompt and "UNTRUSTED DATA" in prompt

    def test_scans_are_spaced_apart(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        world.scan(fid)
        with world.vm.expect_revert("scan too soon"):
            world.scan(fid)
        world.at(SCAN_GAP)
        assert world.scan(fid) == "clear"

    def test_a_flagged_target_blocks_new_proposals(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        assert world.scan(fid, ["sunfield solar"]) == "flagged"
        assert world.c.get_fund(fid)["frozen"] == ["sunfield solar"]
        with pytest.raises(Refused) as e:
            world.propose(fid, sender=world.charlie)
        assert str(e.value) == "target frozen"
        conserved(world)

    def test_a_flagged_target_cannot_execute_until_a_later_scan_clears_it(self, world):
        fid = watched_fund(world)
        pid = world.propose(fid)
        world.resolve(pid)
        world.scan(fid, ["sunfield solar"])
        world.at(WINDOW)
        with world.vm.expect_revert("target frozen"):
            world.execute(pid)
        assert world.paid_to(world.payee_a) == 0
        world.at(WINDOW + SCAN_GAP)
        assert world.scan(fid, []) == "clear"
        assert world.c.get_fund(fid)["frozen"] == []
        assert world.execute(pid) == "executed"
        assert world.paid_to(world.payee_a) == 8000
        conserved(world)

    def test_other_targets_are_unaffected_by_a_freeze(self, world):
        from conftest import WINDCO, WINDCO_PAGE

        fid = watched_fund(world)
        world.propose(fid)
        world.propose(fid, target="windco", urls=[WINDCO], pages=[WINDCO_PAGE], payee=world.payee_b, amount=1000, sender=world.charlie)
        world.scan(fid, ["sunfield solar"])
        pid = world.propose(fid, target="windco", urls=[WINDCO], payee=world.payee_b, amount=500, sender=world.alice)
        assert pid > 0

    def test_an_unreachable_watch_page_leaves_the_last_verdict_standing(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        world.scan(fid, ["sunfield solar"])
        world.at(SCAN_GAP)
        world.pages[WATCH_URL2] = None
        before = len(world.llm_prompts)
        assert world.scan(fid) == "unavailable"
        f = world.c.get_fund(fid)
        assert f["frozen"] == ["sunfield solar"] and f["scan_count"] == 1
        assert len(world.llm_prompts) == before  # the model is never asked about pages it could not read

    def test_the_jury_cannot_flag_a_name_it_was_not_given(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        with world.vm.expect_revert("bad judgment"):
            world.scan(fid, ["some other company"])
        assert world.c.get_fund(fid)["scan_count"] == 0

    @pytest.mark.parametrize("bad", ["not json", json.dumps({"flag": []}), json.dumps({"flagged": "sunfield solar"}), json.dumps({"flagged": [1]})])
    def test_garbage_scan_output_moves_nothing(self, world, bad):
        fid = watched_fund(world)
        world.propose(fid)
        world.mock_world(None, None, bad)
        world.vm.sender = world.charlie
        with world.vm.expect_revert("bad judgment"):
            world.c.scan(fid)
        assert world.c.get_fund(fid)["frozen"] == []

    def test_duplicates_and_prose_are_normalised_away(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        world.mock_world(None, None, json.dumps({"flagged": ["sunfield solar", "sunfield solar"], "why": "documented wage theft"}))
        world.vm.sender = world.charlie
        assert world.c.scan(fid) == "flagged"
        assert world.c.get_fund(fid)["frozen"] == ["sunfield solar"]

    def test_a_frozen_target_stays_in_the_scan_so_it_can_be_cleared(self, world):
        fid = watched_fund(world)
        pid = world.propose(fid)
        world.scan(fid, ["sunfield solar"])
        world.resolve(pid, {"evidence_available": True, "in_theme": False, "excluded": False, "adverse": False})
        assert world.c.get_fund(fid)["positions"][0]["reserved"] == 0  # nothing earmarked or allocated any more
        world.at(SCAN_GAP)
        assert world.scan(fid, []) == "clear"  # still scanned because it is frozen
        assert world.c.get_fund(fid)["frozen"] == []

    def test_a_scan_reads_only_the_frozen_watch_pages(self, world):
        fid = watched_fund(world)
        world.propose(fid)
        world.requests.clear()
        world.scan(fid)
        assert set(world.requests) == {WATCH_URL, WATCH_URL2}

    def test_normalize_scan_rules(self, world):
        m = contract_module()
        ok = m.normalize_scan({"flagged": ["b", "a", "a"], "source": "ok"}, ["a", "b"])
        assert ok == {"flagged": ["a", "b"], "source": "ok"}
        assert m.normalize_scan({"flagged": ["a"], "source": "unavailable"}, ["a"]) == {"flagged": [], "source": "unavailable"}
        assert m.normalize_scan({"flagged": ["z"], "source": "ok"}, ["a"]) is None
        assert m.normalize_scan({"flagged": [], "source": "changed"}, ["a"]) is None
        assert m.normalize_scan({"flagged": []}, ["a"]) is None
