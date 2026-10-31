import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app, parse_need  # noqa: E402

client = TestClient(app)


def setup_module(_):
    client.__enter__()


def teardown_module(_):
    client.__exit__(None, None, None)
    if os.path.exists("test.db"):
        os.remove("test.db")


def test_discover_shape():
    r = client.get("/v1/discover", params={"userId": "t1"})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"] == "6 for you · 1 trending · 1 stretch"
    hero, stretch = body["cards"]
    assert hero["look"]["trendProof"]["isPlaceholder"] is True
    assert stretch["slot"] == "stretch"
    assert hero["photo"] == "/looks/burgundy-cat-eye.jpg"
    assert all(s["verified"] is False for s in hero["look"]["shades"])
    assert len(body["also"]) == 6
    assert body["also"][-1]["slot"] == "trending"


def test_describe_it_parsing():
    f = parse_need("Work dinner next week, medium, chrome please")
    assert f.occasions == ["work", "date night"]
    assert f.finishes == ["chrome"]
    assert f.lengths == ["medium"]


def test_events_update_profile():
    r = client.post("/v1/events", json={"userId": "t2", "type": "too_bold",
                                        "lookId": "emerald-chrome-silver-star", "slot": "stretch", "position": 1})
    assert r.status_code == 201
    prof = client.get("/v1/profile/t2").json()
    assert prof["maxStretch"] == 3


def test_look_404():
    assert client.get("/v1/looks/nope").status_code == 404
