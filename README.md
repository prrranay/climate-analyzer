# Climate Hazard Trend Analyzer

A full-stack climate hazard intelligence platform for ingesting historical meteorological reanalysis data, detecting regional heatwaves, analyzing hazard intensity and duration, and computing honest climatological hazard trends.

## Repository Structure

- **ackend/**: Asynchronous Python backend built with FastAPI, Pydantic v2, PyMongo Async, Redis asyncio, HTTPX, and NumPy/SciPy. Provides RESTful endpoints for geocoding search, point-based heatwave trend analysis, and regional bounding-box spatial analysis.
- **rontend/**: Web user interface client (scheduled for subsequent implementation).

## Backend Documentation

For in-depth backend architecture, OpenAPI specifications, local setup, Docker Compose infrastructure, and scientific climatological methodology, please refer to:
?? [**backend/README.md**](backend/README.md)
