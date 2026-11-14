/**
 * 分けて配る WASM を全て取得し、順につないだ 1 つの Response にする。どれかを取得できないときは失敗する。
 * Response の content-type を application/wasm にして、取得しながらコンパイルできるようにする。
 */
export async function joinParts(
  urls: readonly URL[],
  fetchPart: (url: URL) => Promise<Response> = fetch,
): Promise<Response> {
  const responses = await Promise.all(urls.map((url) => fetchPart(url)));
  for (const [index, response] of responses.entries()) {
    if (!response.ok || response.body === null) {
      throw new Error(`${urls[index]} を取得できませんでした（${response.status}）`);
    }
  }
  const joined = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const response of responses) {
        const reader = (response.body as ReadableStream<Uint8Array>).getReader();
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          controller.enqueue(chunk.value);
        }
      }
      controller.close();
    },
  });
  return new Response(joined, { headers: { "content-type": "application/wasm" } });
}
