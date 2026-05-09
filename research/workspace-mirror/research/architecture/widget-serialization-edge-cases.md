# Widget serialization edge cases — verified against code

<!-- provenance
source_url: file://widget-api-thoughts.md + ComfyUI_frontend/src/extensions/core/{webcamCapture,load3d,load3dLazy,uploadAudio,uploadImage,painter,maskeditor}.ts
date_accessed: 2026-05-08
task: I-WS.2
-->

**Task:** I-WS.2
**Date:** 2026-05-08
**Source claims:** [`widget-api-thoughts.md`](../../widget-api-thoughts.md#L23-L31)
**Files audited:** 7 widgets in `ComfyUI_frontend/src/extensions/core/`

The user's parking-lot list called out 4 categories of risk for moving to
"serialize-on-access":

1. widgets that upload files (e.g. 3d)
2. widgets with heavy perf cost (e.g. webcam)
3. widgets that rely on specific, non-hot-path serialization steps (e.g. webcam)
4. widgets whose post-serialize value depends on lifecycle steps that they
   expect have happened

Each row below confirms whether the actual code matches the claim and pins down
the JSON shape the workflow file ends up holding.

| Widget file | hot-path-perf-cost? | lifecycle-coupled? | value-shape |
|---|---|---|---|
| **`webcamCapture.ts`** | **Yes.** `camera.serializeValue` synchronously paints the live `<video>` onto a `<canvas>` (`ctx.drawImage(video, …)`) at `webcamCapture.ts:97` and `canvas.toBlob` at `webcamCapture.ts:132`, then issues a `POST /upload/image` over the network at `webcamCapture.ts:139-142`. Cost = full-frame pixel copy + multipart upload, on every queue. | **Yes.** The serializer reads the user's lifecycle choice via `captureOnQueue.value` at `webcamCapture.ts:122`; if false it requires `node.imgs?.length` to already exist (set by an earlier `capture()` callback at `webcamCapture.ts:102-106`) and otherwise throws (`webcamCapture.ts:124-128`). It also depends on the deferred `WEBCAM_READY` promise resolving before the camera widget's width/height are known (`webcamCapture.ts:156-168`). | String: `` `${subfolder}/${serverName} [${type}]` `` — server-issued filename built at `webcamCapture.ts:152` (e.g. `"webcam/1714000000000.png [temp]"`). |
| **`load3d.ts`** (Load3D) | **Yes.** `sceneWidget.serializeValue` at `load3d.ts:364-419` calls `currentLoad3d.captureScene(...)` at `load3d.ts:386-389` (renders three.js scene to scene+mask+normal images) and then runs three parallel `Load3dUtils.uploadTempImage` POSTs at `load3d.ts:391-395`; an optional fourth upload for recording video (mp4) at `load3d.ts:411-415`. | **Yes.** Requires the lazy-resolved `nodeToLoad3dMap.get(node)` instance to exist at `load3d.ts:365-369` (registered async in `useLoad3d(...).waitForLoad3d` at `load3d.ts:341`); also stops an in-flight recorder via `currentLoad3d.stopRecording()` at `load3d.ts:380` and writes back into `node.properties['Camera Config']` at `load3d.ts:378` — pure side-effect ordering. | Object: `{ image: 'threed/<name> [temp]', mask: 'threed/<name> [temp]', normal: 'threed/<name> [temp]', camera_info: CameraState \| null, recording: 'threed/<name> [temp]' \| '' }` — assembled at `load3d.ts:399-416`. |
| **`load3dLazy.ts`** | **No.** No `serializeValue` is registered. The file only wires a `beforeRegisterNodeDef` hook (`load3dLazy.ts:59-82`) that dynamically `import()`s `./load3d` and `./saveMesh` at `load3dLazy.ts:38`. | **No (for serialization).** It is itself lifecycle-coupled to node-def registration, but introduces no widget value. The downstream serializer is whichever `load3d.ts` widget got registered. | N/A — no widget value emitted by this module. The Preview3D widget it eventually registers (`load3d.ts:452-466`) is a `ComponentWidgetImpl` whose value flows through `useWidgetValueStore`, not a custom `serializeValue`. |
| **`uploadAudio.ts`** | **Mixed.** The `AUDIO_UI` widget is opted out entirely with `audioUIWidget.serialize = false` at `uploadAudio.ts:125`; the `AUDIOUPLOAD` button is also `serialize: false` at `uploadAudio.ts:266`. The `AUDIO_RECORD` widget's `audioUIWidget.serializeValue` at `uploadAudio.ts:311-332` IS hot: `fetch(audioSrc).then(r => r.blob())` at `uploadAudio.ts:329` followed by `convertBlobToFileAndSubmit(blob)` at `uploadAudio.ts:331` (network upload). | **Yes (AUDIO_RECORD).** The serializer must first stop an in-flight recorder by awaiting `stopPromise` at `uploadAudio.ts:312-320` (resolved by the `mediaRecorder.onstop` handler at `uploadAudio.ts:355-380`); without that await the latest chunks would be lost. Also early-returns `''` and toasts if `audioUIWidget.element.src` is empty (`uploadAudio.ts:322-327`). | For `audio` widget: a path string `<subfolder>/<filename>` set at `uploadAudio.ts:60-75`. For `AUDIO_RECORD`: the filename string returned by `convertBlobToFileAndSubmit` (`uploadAudio.ts:331`) or `''` if nothing recorded. |
| **`uploadImage.ts`** | **No.** The whole module is a `beforeRegisterNodeDef` hook (`uploadImage.ts:23-39`) that adds an `IMAGEUPLOAD` combo input via `createUploadInput` at `uploadImage.ts:12-21`. No `serializeValue`, no canvas/blob work happens here. | **No.** Serialization is just whatever the underlying string combo widget already does (selected filename in the dropdown). The actual upload happens inside `IMAGEUPLOAD`'s renderer, not in serialization. | String: the selected combo value (server-side filename like `"example.png"`) — written to `inputSpec[1].imageInputName` at `uploadImage.ts:19` and consumed by the existing combo widget. |
| **`painter.ts`** | **No.** The whole extension is 22 lines and does only `node.setSize(...)` at `painter.ts:11-12` and toggles `widget.options.hidden` for `width`/`height`/`bg_color` at `painter.ts:16-20`. No `serializeValue` is set. | **No (for serialize).** Nothing in this file participates in serialization; the output flows via `node.imgs`/clipspace from a separate Vue component, gated by `node.hideOutputImages = true` at `painter.ts:14`. | N/A here — the painter node's value-shape is not produced by this file. The (hidden) `width`/`height`/`bg_color` widgets keep their plain numeric/string shapes. |
| **`maskeditor.ts`** | **No.** The file registers commands and a settings panel (`maskeditor.ts:50-159`) and routes `openMaskEditor(node)` at `maskeditor.ts:21` into `useMaskEditor()`. No `serializeValue` and no upload code path lives here. | **Yes, but not at serialize time.** Opening the editor requires `node.imgs?.length` or `previewMediaType === 'image'` (`maskeditor.ts:16-19`), and the editor mutates `node.imgs` / `clipspace` — that mutation is the lifecycle step the eventual workflow value depends on, but the dependency is observed by clipspace plumbing, not by a `serializeValue` in this file. | N/A from this file. The mask is propagated via `node.imgs` + clipspace into the underlying image input, which then serializes as the same combo-string filename used by `uploadImage.ts`. |

## Confirmation against the source claims

- "widgets that upload files: 3d" → **confirmed** for `load3d.ts` (3 + optional 4
  uploads in one serializer) and also true of `webcamCapture.ts` and the
  `AUDIO_RECORD` path in `uploadAudio.ts`.
- "widgets with heavy perf cost: webcam" → **confirmed**: a full canvas
  draw + blob + network round-trip on every serialize.
- "widgets that rely on specific, non-hot-path, serialization steps: webcam"
  → **confirmed**: the serializer doubles as the side-effecting "capture and
  upload" step; serializing without first calling `capture()` (and outside
  `captureOnQueue`) throws.
- "widgets whose post-serialize value depends on life cycle steps they
  expect have happened" → **confirmed** in three places:
  1. `webcamCapture.ts:124` requires `node.imgs` from a prior capture.
  2. `load3d.ts:365` requires the async `nodeToLoad3dMap` registration.
  3. `uploadAudio.ts:312-320` requires `MediaRecorder.stop()` to drain the
     last chunks before `audioUIWidget.element.src` becomes meaningful.

`painter.ts`, `maskeditor.ts`, `uploadImage.ts`, and `load3dLazy.ts` do **not**
ship a `serializeValue` of their own — their workflow value is whatever the
underlying ComfyUI widget already emits (combo-string filename), with the
lifecycle step (image draw, mask paint) recorded out-of-band via `node.imgs` /
clipspace.

## Implications for I-WS.3 lazy-getter design

The 4-of-7 widgets that actually ship a `serializeValue` (`webcamCapture`,
`load3d`'s Load3D, and `uploadAudio`'s AUDIO_RECORD) all do **three** things in
the same async function: (a) finalize a lifecycle step (call `capture()`,
`stopRecording()`, `mediaRecorder.stop()`), (b) read a non-trivial source
(canvas/three.js scene/MediaRecorder blob), and (c) POST it to the backend and
embed the server-issued filename(s) in the return. A naive "lazy getter on
every property access" model would re-trigger all three on each read, which is
both expensive and side-effectful (e.g. it would re-stop the recorder, re-issue
upload requests, and overwrite `node.properties['Camera Config']`). Therefore
**I-WS.3** should design the lazy getter as a **memoized, single-flight,
queue-scoped promise** keyed to a "serialization epoch" (one resolved value per
prompt-queue submission), with explicit invalidation hooks for the lifecycle
events that legitimately produce a new value (new capture, new recording,
camera change). The remaining 3-of-7 widgets that piggy-back on the existing
combo-string + `node.imgs` channel are safe to expose as a synchronous getter
in I-WS.3, because their "value" is already a stable string by the time
serialization runs.
