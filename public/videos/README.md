# ApplyLab Extension Video Assets

This directory hosts the video files for the **Animated Autofill Video Showcase** component on the landing page (`#extension-copilot`).

## Target Files
- `applylab-workday-autofill.webm` (VP9/AV1 codec, target size ~800KB - 1MB)
- `applylab-workday-autofill.mp4` (H.264 high profile, faststart, target size ~1.1MB)

## Encoding Instructions (from Spec)
```bash
# Convert master MP4 to optimized WebM
ffmpeg -i master-recording.mov -c:v libvpx-vp9 -b:v 1M -crf 30 -an -vf "scale=1920:-1" applylab-workday-autofill.webm

# Convert master MP4 to optimized H.264 MP4 fallback
ffmpeg -i master-recording.mov -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -b:v 1.2M -an -movflags +faststart applylab-workday-autofill.mp4

# Generate high-res WebP poster image
ffmpeg -i master-recording.mov -ss 00:00:04 -vframes 1 -q:v 85 ../images/autofill-demo-poster.webp
```

## Fallback Behavior
If no video file is present or while the video is downloading, `AutofillVideoShowcase.tsx` automatically renders the ultra-smooth 60fps choreographed live motion simulation of the Workday 1-click cascade.
