# Mandate demo video (about 1:30)

An end-to-end film of the **live deployment**, captured at 1920x1080, with explanatory captions and an original synthesized soundtrack. Nothing is mocked: the jury round and the execution you see are real transactions on GenLayer Studionet, made with a throwaway demo account on a proposal created for the film.

```
prepare.mjs ─► capture.mjs ─► (music.py) ─► build.mjs ─► out/mandate-demo.mp4 + .srt
 one fresh      real browser      numpy-      slow camera moves, caption fades,
 live proposal  screens + a real  synthesized crossfades, soundtrack mixed in
                jury + execute    soundtrack
```

## Make it

```bash
cd video && npm install
python music.py                                          # audio/soundtrack.wav (original, ~2 min to synthesize)
node --experimental-strip-types prepare.mjs              # creates the live proposal -> live.json
node --experimental-strip-types capture.mjs              # films the site into frames/ (about 10 minutes: it waits for real validators)
node build.mjs                                           # out/mandate-demo.mp4 and out/mandate-demo.srt
```

`capture.mjs <shot ids…>` re-films just those shots. ffmpeg comes from the `imageio-ffmpeg` Python package (`FFMPEG` overrides it) and Edge is used for capture (`EDGE_PATH` overrides it).

## Editing

Everything editorial is in `storyboard.mjs`: shot order, on-screen caption copy and shot lengths. `build.mjs` keys rendered clips by duration, so changing a caption or a length re-renders only what changed.

## Notes

- The footage is of a **test network** and a **throwaway demo account**; the end card says so.
- The proposal target name is bound to its payee by the contract, so `prepare.mjs` needs a target name that has not been used before when re-run.
- Output, frames, clips and the synthesized audio are gitignored.
