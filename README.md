# [Client-Side-Object-Detector](https://github.com/europanite/client-side-object-detector "Client-Side-Object-Detector")

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
![OS](https://img.shields.io/badge/OS-Linux%20%7C%20macOS%20%7C%20Windows-blue)

![React Native](https://img.shields.io/badge/react_native-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=for-the-badge&logo=jest&logoColor=white)
![Expo](https://img.shields.io/badge/expo-1C1E24?style=for-the-badge&logo=expo&logoColor=#D04A37)

A frontend-only Expo Web application that detects **COCO object classes** from either a local image or a local webcam, draws bounding boxes, counts detections, and exports source coordinates as JSON.

The selected image and webcam video stay in the browser. There is no application backend.

## Features

- Expo + React Native Web frontend
- TensorFlow.js inference in the browser
- COCO-SSD object detection
- Input source: local image
- Input source: local webcam via `getUserMedia()`
- Continuous webcam inference (about 2 detections/second)
- Multiple webcam selection after browser permission is granted
- Detects `person`, `car`, and many other COCO classes
- Optional class filter (comma-separated)
- Bounding boxes over images and live webcam video
- Total object count
- Counts by class
- Original source pixel coordinates
- `x, y, width, height` and `x1, y1, x2, y2`
- Confidence threshold control
- Copy/download JSON results
- GitHub Pages deployment workflow
- Docker Compose static build/serve option

## Architecture

```text
Local image OR local webcam
          ↓
    Browser / Expo Web
          ↓
 TensorFlow.js + COCO-SSD
          ↓
 optional class filter
          ↓
Bounding boxes + counts + JSON
```

The COCO-SSD model weights are fetched by the browser when the model is first loaded. User images and camera frames are not sent to a project server.

## Webcam mode

Click **Start webcam** and allow camera access in the browser. Detection then runs continuously in the browser.

If more than one video-input device is available, buttons are shown to switch cameras.

Browser webcam APIs require a secure context. GitHub Pages uses HTTPS, and browsers normally also permit camera access on `localhost` during development.

## Run locally

Expo SDK 57 requires Node.js 22.13 or newer.

```bash
cd frontend/app
npm install
npm run web
```

Then open the URL printed by Expo.

## Docker Compose

The Docker image uses a **single Node.js stage**. Expo Web is built during the image build, and a small Node.js static server serves the exported `dist/` directory under `/car_bbox_detector/`. No nginx image or multi-stage build is used.

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080/
```

## Output example

```json
{
  "image": {
    "width": 1920,
    "height": 1080,
    "coordinateSystem": "pixels; origin=(0,0) at top-left"
  },
  "totalCount": 3,
  "countsByClass": {
    "car": 2,
    "person": 1
  },
  "requestedClasses": ["car", "person"],
  "detections": [
    {
      "id": 1,
      "class": "car",
      "score": 0.93,
      "x": 121.4,
      "y": 355.2,
      "width": 402.8,
      "height": 271.6,
      "x1": 121.4,
      "y1": 355.2,
      "x2": 524.2,
      "y2": 626.8
    }
  ]
}
```

In webcam mode, the same coordinate format is relative to the webcam frame dimensions reported by the browser.

## Coordinate system

Coordinates are in pixels relative to the **original source frame**, not the scaled browser preview.

```text
(0,0) ───────────→ x
  │
  │    ┌──────────────┐
  │    │    object    │
  │    └──────────────┘
  ↓
  y
```

COCO-SSD returns boxes in `[x, y, width, height]` form. This project also derives `(x1, y1)` and `(x2, y2)`.

## Class filtering

This version can keep **all COCO classes** or a user-specified subset such as:

- `person`
- `car`
- `truck`
- `bus`
- `bicycle`
- `dog`

Use a comma-separated filter like `person, car, bus`, or leave the field blank to keep every class returned by COCO-SSD.

## Privacy

- No image upload endpoint
- No webcam streaming to a backend
- No backend database
- No face recognition
- No license-plate recognition

Camera permission is requested by the browser and can be revoked using normal browser/site permissions.

## License

- Apache-2.0
