import { TextEmbeddingsModule, ALL_MINILM_L6_V2 } from 'react-native-executorch';

const MODEL_ASSET = require('../../assets/models/all-MiniLM-L6-v2_xnnpack.pte');

let embeddingsInstance: TextEmbeddingsModule | null = null;

export async function getEmbeddings() {
  if (!embeddingsInstance) {
    const instance = new TextEmbeddingsModule();
    await instance.load({
      modelSource: MODEL_ASSET,
      tokenizerSource: ALL_MINILM_L6_V2.tokenizerSource,
    });
    embeddingsInstance = instance;
  }
  return embeddingsInstance;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const engine = await getEmbeddings();
  const vector = await engine.forward(text);
  return Array.from(vector);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const engine = await getEmbeddings();
  const results: number[][] = [];
  for (const text of texts) {
    const vector = await engine.forward(text);
    results.push(Array.from(vector));
  }
  return results;
}
