export class PersonalActivityNotFoundError extends Error {
  constructor() {
    super("Activity not found.");
    this.name = "PersonalActivityNotFoundError";
  }
}
