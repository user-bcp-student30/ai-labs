import { isRecord } from './type-guards';

type BackendMessageField = 'message' | 'detail';

export function getErrorMessage(
  error: unknown,
  backendMessageField: BackendMessageField,
  fallback: string
): string {
  if (isRecord(error)) {
    const response = error['response'];
    if (isRecord(response)) {
      const data = response['data'];
      if (isRecord(data)) {
        const backendMessage = data[backendMessageField];
        if (typeof backendMessage === 'string' && backendMessage) {
          return backendMessage;
        }
      }
    }

    const errorMessage = error['message'];
    if (typeof errorMessage === 'string' && errorMessage) {
      return errorMessage;
    }
  }

  return fallback;
}