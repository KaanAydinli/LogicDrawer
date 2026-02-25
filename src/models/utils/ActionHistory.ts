export class ActionHistory {
  public static readonly MAX_HISTORY = 50;
  public static undoStack: string[] = [];
  public static redoStack: string[] = [];

  public static saveState(state: string): void {
    
    if (ActionHistory.undoStack.length > 0) {
      const lastState = ActionHistory.undoStack[ActionHistory.undoStack.length - 1];
      if (lastState === state) return;
    }

    ActionHistory.undoStack.push(state);

   
    ActionHistory.redoStack = [];

    
    if (ActionHistory.undoStack.length > ActionHistory.MAX_HISTORY) {
      ActionHistory.undoStack.shift();
    }
  }

  public static undo(): string | null {
    if (ActionHistory.undoStack.length > 1) {
      // Keep at least one initial state
      const currentState = ActionHistory.undoStack.pop();
      if (currentState) {
        ActionHistory.redoStack.push(currentState);
      }
      return ActionHistory.undoStack[ActionHistory.undoStack.length - 1] || null;
    }
    return null;
  }

  public static redo(): string | null {
    if (ActionHistory.redoStack.length > 0) {
      const stateToRestore = ActionHistory.redoStack.pop();
      if (stateToRestore) {
        ActionHistory.undoStack.push(stateToRestore);
        return stateToRestore;
      }
    }
    return null;
  }

  public static clear(): void {
    ActionHistory.undoStack = [];
    ActionHistory.redoStack = [];
  }
}
