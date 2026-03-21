import React, { createContext, useContext, useState, useEffect } from "react";
import { createStateLocal, updateStateLocal, deleteStateLocal, getAllStates, pullData, searchStates, upsertEmbedding, getStateIdByUcode, getStatesWithoutEmbeddings } from "../src/db/turso";
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
  const searchCounterRef = React.useRef(0);

  const loadStates = async () => {
    setLoading(true);
    searchCounterRef.current++; // Invalidate any pending searches
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
      const id = await createStateLocal(ucode, title, payload, SCOPE);
      try {
        const textToEmbed = `${title} ${JSON.stringify(payload)}`.substring(0, 1000);
        const vector = await generateEmbedding(textToEmbed);
        await upsertEmbedding(id, vector);
      } catch (e) {
        console.warn('Embedding generation failed during create:', e);
      }
      await loadStates();
    } finally {
      setLoading(false);
    }
  };

  const updateState = async (ucode: string, title: string, payload: any) => {
    setLoading(true);
    try {
      await updateStateLocal(ucode, title, payload, SCOPE);
      try {
        const stateId = await getStateIdByUcode(ucode, SCOPE);
        if (stateId) {
          const textToEmbed = `${title} ${JSON.stringify(payload)}`.substring(0, 1000);
          const vector = await generateEmbedding(textToEmbed);
          await upsertEmbedding(stateId, vector);
        }
      } catch (e) {
        console.warn('Embedding generation failed during update:', e);
      }
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
      const missing = await getStatesWithoutEmbeddings(SCOPE);

      if (missing.length === 0) return;

      console.log(`Re-indexing ${missing.length} missing embeddings...`);
      for (const item of missing as any[]) {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));

          const payloadObj = (item.payload && typeof item.payload === 'string')
            ? JSON.parse(item.payload)
            : (item.payload || {});

          const textToEmbed = `${item.title || ''} ${JSON.stringify(payloadObj)}`.substring(0, 1000);
          const vector = await generateEmbedding(textToEmbed);
          if (item.id) {
            await upsertEmbedding(item.id, vector);
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
    const trimmedQuery = query.trim();
    const currentSearchId = ++searchCounterRef.current;
    
    if (!trimmedQuery) {
      return;
    }

    setLoading(true);
    try {
      const vector = await generateEmbedding(trimmedQuery);
      
      // Only update result if this is still the latest search
      if (currentSearchId === searchCounterRef.current) {
        const results = await searchStates(vector, SCOPE);
        setResult({ result: results });
      }
    } catch (e) {
      if (currentSearchId === searchCounterRef.current) {
        console.error('Semantic search failed:', e);
      }
    } finally {
      if (currentSearchId === searchCounterRef.current) {
        setLoading(false);
      }
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
