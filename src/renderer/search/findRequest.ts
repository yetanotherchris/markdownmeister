/** A request to open the editor's find box in a specific document. `seq`
 *  increments so a repeated request is distinguishable from the previous one;
 *  `replace` reveals the replace row as the box opens. Shared by both editing
 *  views, which is why it does not live in either search module. */
export interface FindRequest {
  id: string
  seq: number
  replace?: boolean
}

/** The per-document signal handed to whichever editing surface owns the
 *  document: the sequence number dedupes repeated requests and the flag says
 *  whether the replace row should be revealed. */
export interface FindSignal {
  seq: number
  replace: boolean
}
