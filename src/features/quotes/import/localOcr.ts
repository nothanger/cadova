type OcrResult = { text: string; confidence: number }
type PendingRead = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

/** Small adapter for the bundled, pinned Tesseract 6 worker protocol.
 * We own the native Worker from construction, including language loading, so
 * cancellation releases it immediately rather than waiting for createWorker(). */
export class LocalOcr {
  private readonly worker: Worker
  private readonly pending = new Map<string, PendingRead>()
  private readonly assets: string
  private ready?: Promise<void>
  private sequence = 0
  private closed = false

  constructor(
    assets: string,
    private readonly signal: AbortSignal,
    onProgress: (value: number) => void,
  ) {
    if (signal.aborted) throw new DOMException("Lecture annulée.", "AbortError")
    this.assets = new URL(assets, window.location.href).href
    this.worker = new Worker(`${this.assets}ocr/worker.min.js`)
    this.worker.onmessage = ({ data }) => {
      const pending = this.pending.get(data.jobId)
      if (!pending) return
      if (data.status === "progress") {
        if (
          data.data?.status === "recognizing text" &&
          Number.isFinite(data.data.progress)
        )
          onProgress(data.data.progress)
        return
      }
      this.pending.delete(data.jobId)
      if (data.status === "resolve") pending.resolve(data.data)
      else
        pending.reject(
          new Error("La lecture automatique est indisponible sur cet appareil."),
        )
    }
    this.worker.onerror = (event) => {
      event.preventDefault()
      this.close(new Error("Les ressources de lecture n’ont pas pu être chargées."))
    }
    this.worker.onmessageerror = () =>
      this.close(new Error("Le document n’a pas pu être lu sur cet appareil."))
    signal.addEventListener("abort", this.abort, { once: true })
  }

  private abort = () => this.close(new DOMException("Lecture annulée.", "AbortError"))

  private request(
    action: string,
    payload: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<unknown> {
    if (this.closed)
      return Promise.reject(new Error("La lecture automatique est interrompue."))
    const jobId = `read-${++this.sequence}`
    return new Promise((resolve, reject) => {
      this.pending.set(jobId, { resolve, reject })
      try {
        this.worker.postMessage(
          { workerId: "cadova-local-reader", jobId, action, payload },
          transfer,
        )
      } catch {
        this.close(new Error("Le document n’a pas pu être lu sur cet appareil."))
      }
    })
  }

  private async initialize() {
    await this.request("load", {
      options: { lstmOnly: true, corePath: `${this.assets}ocr`, logging: false },
    })
    await this.request("loadLanguage", {
      langs: "fra",
      options: {
        langPath: `${this.assets}ocr`,
        gzip: true,
        lstmOnly: true,
        cacheMethod: "none",
      },
    })
    await this.request("initialize", { langs: "fra", oem: 1, config: {} })
    await this.request("setParameters", { params: { preserve_interword_spaces: "1" } })
  }

  async recognize(image: ArrayBuffer): Promise<OcrResult> {
    try {
      this.ready ??= this.initialize()
      await this.ready
      const result = (await this.request(
        "recognize",
        { image: new Uint8Array(image), options: {}, output: { text: true } },
        [image],
      )) as Partial<OcrResult>
      return {
        text: typeof result.text === "string" ? result.text.slice(0, 160_000) : "",
        confidence: Number(result.confidence) || 0,
      }
    } catch (error) {
      this.close(
        error instanceof Error
          ? error
          : new Error("La lecture automatique est indisponible."),
      )
      throw error
    }
  }

  close(reason = new Error("La lecture automatique est terminée.")) {
    if (this.closed) return
    this.closed = true
    this.signal.removeEventListener("abort", this.abort)
    this.worker.terminate()
    for (const pending of this.pending.values()) pending.reject(reason)
    this.pending.clear()
  }
}
