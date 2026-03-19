import React, { createContext, useContext, useState, useEffect } from "react";
import { createStateLocal, updateStateLocal, deleteStateLocal, getAllStates, pullData, searchStates } from "../src/db/turso";
import { generateEmbedding } from "../src/lib/embeddings";

type AgentState = {
  loading: boolean;
  result: any;
  setLoading: (v: boolean) => void;
  setResult: (v: any) => void;
  loadStates: () => Promise<void>;
  createState: (ucode: string, title: string, payload: any) => Promise<void>;
  updateState: (ucode: string, title: string, payload: any) => Promise<void>;
  deleteState: (ucode: string) => Promise<void>;
  search: (query: string) => Promise<void>;
};

const AgentContext = createContext<AgentState>({
  loading: false,
  result: null,
  setLoading: () => {},
  setResult: () => {},
  loadStates: async () => {},
  createState: async () => {},
  updateState: async () => {},
  deleteState: async () => {},
  search: async () => {},
});

const SCOPE = "shop:main";

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const loadStates = async () => {
    setLoading(true);
    try {
      // Sync first
      await pullData();
      
      const states = await getAllStates(SCOPE);
      setResult({ result: states });

      // Re-index any missing embeddings locally in the background
      reindexMissingEmbeddings().catch(err => console.error('Background re-indexing error:', err));
    } catch (e) {
      console.error('Failed to load local states:', e);
      // Fallback: still try to load what we have
      try {
        const states = await getAllStates(SCOPE);
        setResult({ result: states });
      } catch (innerE) {
        console.error('Total failure loading states:', innerE);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStates();
  }, []);

  const createState = async (ucode: string, title: string, payload: any) => {
    setLoading(true);
    try {
      let embedding: number[] | undefined;
      try {
        const textToEmbed = `${title} ${JSON.stringify(payload)}`.substring(0, 1000);
        embedding = await generateEmbedding(textToEmbed);
      } catch (e) {
        console.warn('Embedding generation failed during create:', e);
      }
      await createStateLocal(ucode, title, payload, SCOPE, embedding);
      await loadStates();
    } finally {
      setLoading(false);
    }
  };

  const updateState = async (ucode: string, title: string, payload: any) => {
    setLoading(true);
    try {
      let embedding: number[] | undefined;
      try {
        const textToEmbed = `${title} ${JSON.stringify(payload)}`.substring(0, 1000);
        embedding = await generateEmbedding(textToEmbed);
      } catch (e) {
        console.warn('Embedding generation failed during update:', e);
      }
      await updateStateLocal(ucode, title, payload, SCOPE, embedding);
      await loadStates();
    } finally {
      setLoading(false);
    }
  };

  const deleteState = async (ucode: string) => {
    setLoading(true);
    try {
      await deleteStateLocal(ucode, SCOPE);
      await loadStates();
    } finally {
      setLoading(false);
    }
  };

  const reindexMissingEmbeddings = async () => {
    try {
      const states = await getAllStates(SCOPE);
      const missing = states.filter((s: any) => !s.embedding);
      
      if (missing.length === 0) return;
      
      console.log(`Re-indexing ${missing.length} missing embeddings...`);
      // We process in a loop with small delays to avoid hanging the UI
      for (const item of missing) {
        try {
          // Give the UI a chance to breathe between intensive AI tasks
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const payloadObj = (item.payload && typeof item.payload === 'string') 
            ? JSON.parse(item.payload) 
            : (item.payload || {});
          
          const textToEmbed = `${item.title || ''} ${JSON.stringify(payloadObj)}`.substring(0, 1000);
          const vector = await generateEmbedding(textToEmbed);
          const ucode = item.ucode || item.streamid;
          if (ucode) {
            await updateStateLocal(ucode as string, item.title as string | undefined, payloadObj, SCOPE, vector);
          }
        } catch (err) {
          console.warn(`Failed to re-index ${item.ucode}:`, err);
        }
      }
    } catch (e) {
      console.error('Re-indexing process failed:', e);
    }
  };

  const search = async (query: string) => {
    setLoading(true);
    try {
      const vector = await generateEmbedding(query);
      const results = await searchStates(vector, SCOPE);
      setResult({ result: results });
    } catch (e) {
      console.error('Semantic search failed:', e);
    } finally {
      setLoading(false);
    }
  };


  return (
    <AgentContext.Provider
      value={{
        loading,
        result,
        setLoading,
        setResult,
        loadStates,
        createState,
        updateState,
        deleteState,
        search,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export const useAgentState = () => useContext(AgentContext);
