const typeToCallbackStack = new Map<string, (() => void)[]>();

export function pushWindowEventListener(type: string, callback: () => void) {
  const stack = typeToCallbackStack.get(type) || [];
  if (stack.length > 0) {
    window.removeEventListener(type, stack[stack.length - 1]);
  }
  window.addEventListener(type, callback);
  stack.push(callback);
  typeToCallbackStack.set(type, stack);
}

export function popWindowEventListener(type: string) {
  const stack = typeToCallbackStack.get(type);
  if (!stack) {
    return;
  }

  const callbackToRemove = stack.pop();
  if (!callbackToRemove) {
    return;
  }

  window.removeEventListener(type, callbackToRemove);
  if (stack.length === 0) {
    return;
  }

  window.addEventListener(type, stack[stack.length - 1]);
  typeToCallbackStack.set(type, stack);
}

export enum WindowEvent {
  CTRLF = 'ctrl+f',
  ESCAPE = 'escape',
}
