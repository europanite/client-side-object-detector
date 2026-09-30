# Contributing

Issues and pull requests are welcome. Please keep the project frontend-only and avoid adding image-upload backends unless the project direction explicitly changes.

Before submitting a pull request:

```bash
cd frontend/app
npm install
npm run typecheck
npm test -- --runInBand
npm run build:web
```
