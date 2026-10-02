/* eslint-disable @typescript-eslint/no-require-imports -- Uses the existing dependency-free Node test loader. */
require("./load-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseYouTubeId, normalizeYouTubeUrl } = require("../src/lib/youtube.ts");

const V = "dQw4w9WgXcQ";

test("parses every URL form present in the live library (shorts, youtu.be ?si=, watch?v=)", () => {
  assert.equal(parseYouTubeId("https://youtube.com/shorts/FkEwrtyb4sc?si=kkNhTqbXVxTHkpl_"), "FkEwrtyb4sc");
  assert.equal(parseYouTubeId("https://youtube.com/shorts/i98CD_LVYj4?si=l4a-Bri9yWoXqQ6Y"), "i98CD_LVYj4");
  assert.equal(parseYouTubeId("https://youtu.be/SCVCLChPQFY?si=r2Yw2QMmYoNKHgrD"), "SCVCLChPQFY");
  assert.equal(parseYouTubeId(`https://youtu.be/${V}?si=AbC&t=12`), V);
  assert.equal(parseYouTubeId(`https://youtu.be/${V}?feature=shared`), V);
  assert.equal(parseYouTubeId(`https://www.youtube.com/watch?v=${V}`), V);
});

test("accepts the other forms people paste", () => {
  for (const u of [
    `https://www.youtube.com/watch?v=${V}&list=PLx&index=2`,
    `https://www.youtube.com/watch?feature=share&v=${V}`,
    `https://www.youtube.com/watch?v=${V}#t=30`,
    `https://m.youtube.com/watch?v=${V}`,
    `https://music.youtube.com/watch?v=${V}&si=abc`,
    `https://m.youtube.com/shorts/${V}?feature=share`,
    `https://www.youtube.com/shorts/${V}/`,
    `https://www.youtube.com/live/${V}?si=abcDEF`,
    `https://www.youtube.com/embed/${V}?start=30`,
    `https://www.youtube-nocookie.com/embed/${V}`,
    `https://www.youtube.com/v/${V}`,
    `youtube.com/watch?v=${V}`,
    `www.youtube.com/watch?v=${V}`,
    `youtu.be/${V}`,
    `//www.youtube.com/watch?v=${V}`,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${V}`,
    `https://YOUTU.BE/${V}`,
    `https://www.youtube.com:443/watch?v=${V}`,
    `  https://youtu.be/${V}/\n`,
    V,
  ]) assert.equal(parseYouTubeId(u), V, u);
});

test("ids starting with - or _ survive in every position", () => {
  assert.equal(parseYouTubeId("https://youtu.be/-7rtg9INTe8?si=x"), "-7rtg9INTe8");
  assert.equal(parseYouTubeId("https://www.youtube.com/watch?v=__AsD5K0i3Y"), "__AsD5K0i3Y");
  assert.equal(parseYouTubeId("https://youtube.com/shorts/-7rtg9INTe8"), "-7rtg9INTe8");
  assert.equal(parseYouTubeId("-7rtg9INTe8"), "-7rtg9INTe8");
  assert.equal(parseYouTubeId("__AsD5K0i3Y"), "__AsD5K0i3Y");
});

test("rejects over-long / short ids instead of truncating them", () => {
  for (const u of [
    "https://youtu.be/abcdefghijklmnop",
    "youtu.be/abcdefghijklmnop",
    "https://www.youtube.com/watch?v=abcdefghijklmnop",
    "https://youtube.com/shorts/abcdefghijklmnop?si=x",
    "https://www.youtube.com/watch?v=abc",
    "dQw4w9WgXc",
    "dQw4w9WgXcQQ",
  ]) assert.equal(parseYouTubeId(u), null, u);
});

test("rejects non-YouTube hosts that merely contain a YouTube URL", () => {
  for (const u of [
    "https://evil.example/?u=youtube.com/watch?v=XXXXXXXXXXX",
    "https://evil.example/youtube.com/watch?v=XXXXXXXXXXX",
    "https://evil.example/youtu.be/XXXXXXXXXXX",
    `https://notyoutube.com/watch?v=${V}`,
    `https://notyoutu.be/${V}`,
    `https://youtube.com.evil.example/watch?v=${V}`,
    `https://youtube.com@evil.example/watch?v=${V}`,
    `javascript:alert(1)//youtube.com/watch?v=${V}`,
    "https://vimeo.com/123456789",
  ]) assert.equal(parseYouTubeId(u), null, u);
  assert.equal(normalizeYouTubeUrl("https://evil.example/?u=youtube.com/watch?v=XXXXXXXXXXX"), null);
});

test("rejects YouTube pages that are not a single video", () => {
  for (const u of [
    "https://www.youtube.com/embed/videoseries?list=PLx",
    "https://www.youtube.com/embed/live_stream?channel=UCx",
    "https://www.youtube.com/playlist?list=PLx",
    "https://www.youtube.com/watch?list=PLx",
    "https://www.youtube.com/@AlisanPhysio",
    "https://youtu.be/",
  ]) assert.equal(parseYouTubeId(u), null, u);
  for (const u of [null, undefined, "", "   "]) assert.equal(parseYouTubeId(u), null);
});

test("finds the link in pasted embed code, surrounding text and punctuation", () => {
  for (const u of [
    `<iframe width="560" height="315" src="https://www.youtube.com/embed/${V}?si=abc" title="YouTube video player" allowfullscreen></iframe>`,
    `Video: https://youtu.be/${V}`,
    `(https://youtu.be/${V})`,
    `https://youtu.be/${V}.`,
    `"https://www.youtube.com/watch?v=${V}",`,
    `<https://youtube.com/shorts/${V}?si=x>`,
    `\u200Bhttps://youtu.be/${V}\u200B`,
  ]) assert.equal(parseYouTubeId(u), V, u);
});

test("ordinary words are never mistaken for a video id", () => {
  // "comfortably" is 11 letters; only a bare id on its own counts.
  for (const u of ["move comfortably", "see notes: comfortably done", `Video: https://evil.example/watch?v=${V}`])
    assert.equal(parseYouTubeId(u), null, u);
});

test("externalVideoUrl: a non-YouTube http(s) override is a link only when nothing plays", () => {
  const { externalVideoUrl } = require("../src/lib/youtube.ts");
  const VIMEO = "https://vimeo.com/123456";
  assert.equal(externalVideoUrl(VIMEO, null), VIMEO);
  assert.equal(externalVideoUrl(`  ${VIMEO}  `, ""), VIMEO);
  assert.equal(externalVideoUrl("http://example.com/demo.mp4", "not a link"), "http://example.com/demo.mp4");
  // A playable video wins: the override itself, or the library video.
  assert.equal(externalVideoUrl(`https://youtu.be/${V}`, null), null);
  assert.equal(externalVideoUrl(VIMEO, `https://youtu.be/${V}`), null);
  // Not a web link: nothing for the client.
  for (const u of [null, undefined, "", "   ", "see notes", "javascript:alert(1)", "ftp://x.test/a", "https://", "https://a b.test"])
    assert.equal(externalVideoUrl(u, null), null, String(u));
});
