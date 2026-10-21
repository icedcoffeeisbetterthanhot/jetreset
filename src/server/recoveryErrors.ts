export class RecoveryActivityNotFoundError extends Error {
  constructor() {
    super("Recovery activity not found.");
    this.name = "RecoveryActivityNotFoundError";
  }
}
