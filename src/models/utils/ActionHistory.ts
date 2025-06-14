export class ActionHistory {
  public static undoStack: string[] = [];

  public static saveState(state: string): void {

    ActionHistory.undoStack.push(state);
  }
  public static undo(): string | null {
    if (ActionHistory.undoStack.length > 0) {
      return ActionHistory.undoStack.pop() || null;
    }
    return null;
  }                                         
}
