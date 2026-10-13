# React is built once; Node and source files stay outside the runtime image.
FROM node:24-alpine AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
# esbuild uses its platform-specific optional package; no install hooks needed.
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS builder
WORKDIR /build
# Changes to application code do not invalidate the dependency download layer.
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/app .

# No compiler, package manager or shell; nonroot runs with UID 65532.
FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=builder /out/app /app/app
COPY --from=frontend /build/dist /app/static
EXPOSE 8080
USER 65532:65532
ENTRYPOINT ["/app/app"]
