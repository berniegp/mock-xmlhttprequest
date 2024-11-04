import type RequestData from './RequestData.ts';

/**
 * Methods for responding to MockXhr requests
 */
export interface MockXhrResponseReceiver {
  uploadProgress(request: RequestData, requestBodyTransmitted: number) : void;

  setResponseHeaders(
    request: RequestData,
    status?: number,
    headers?: Record<string, string> | null,
    statusText?: string
  ) : void;

  downloadProgress(request: RequestData, receivedBytesLength: number, length: number): void;

  setResponseBody(request: RequestData, body: unknown): void;

  setNetworkError(request: RequestData): void;

  setRequestTimeout(request: RequestData): void;
}
