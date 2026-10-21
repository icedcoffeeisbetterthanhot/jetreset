export class FlightSegmentNotFoundError extends Error {
  constructor() {
    super("Flight segment not found.");
    this.name = "FlightSegmentNotFoundError";
  }
}
