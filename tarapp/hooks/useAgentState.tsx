import React, { createContext, useContext, useState, useEffect } from "react";
import { createStateLocal, updateStateLocal, deleteStateLocal, getAllStates, searchStates, upsertEmbedding, getStateIdByUcode, getStatesWithoutEmbeddings, getInstancesByState, createInstance, updateInstance, deleteInstance, Instance } from "../src/db/turso";
import { generateEmbedding } from "../src/lib/embeddings";
import { listStatesApi } from "../src/api/client";

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
  loadInstances: (stateid: string) => Promise<Instance[]>;
  addInstance: (data: { stateid: string; qty?: number; value?: number; currency?: string; available?: boolean; type?: string }) => Promise<void>;
  editInstance: (id: string, data: Partial<Instance>) => Promise<void>;
  removeInstance: (id: string) => Promise<void>;
  fetchStatesFromRemote: (type?: string) => Promise<any[]>;
  // Global picker state
  isPickerVisible: boolean;
  setPickerVisible: (v: boolean) => void;
  isSearchVisible: boolean;
  setSearchVisible: (v: boolean) => void;
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
  loadInstances: async () => [],
  addInstance: async () => {},
  editInstance: async () => {},
  removeInstance: async () => {},
  fetchStatesFromRemote: async () => [],
  isPickerVisible: false,
  setPickerVisible: () => {},
  isSearchVisible: false,
  setSearchVisible: () => {},
});

const SCOPE = "shop:main";

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const searchCounterRef = React.useRef(0);

  const loadStates = async () => {
    setLoading(true);
    searchCounterRef.current++; // Invalidate any pending searches
    try {
      // API-only: fetch states from remote, no local sync
      const response = await listStatesApi(SCOPE);
      setResult({ result: response.result || [] });
    } catch (e) {
      console.error('Failed to load states from API:', e);
      setResult({ result: [] });
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

  // Instance methods for working state under products/services
  const loadInstances = async (stateid: string): Promise<Instance[]> => {
    try {
      return await getInstancesByState(stateid, SCOPE);
    } catch (e) {
      console.error('Failed to load instances:', e);
      return [];
    }
  };

  const addInstance = async (data: { stateid: string; qty?: number; value?: number; currency?: string; available?: boolean; type?: string }) => {
    setLoading(true);
    try {
      await createInstance({ ...data, scope: SCOPE });
    } catch (e) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  };

  const editInstance = async (id: string, data: Partial<Instance>) => {
    setLoading(true);
    try {
      // Convert boolean available to number for API
      const apiData = { ...data };
      if (apiData.available !== undefined) {
        apiData.available = apiData.available ? 1 : 0 as any;
      }
      await updateInstance(id, apiData);
    } catch (e) {
      console.error('Failed to update instance:', e);
    } finally {
      setLoading(false);
    }
  };

  const removeInstance = async (id: string) => {
    setLoading(true);
    try {
      await deleteInstance(id);
    } catch (e) {
      console.error('Failed to delete instance:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch states from remote for instance creation flow
  const fetchStatesFromRemote = async (type?: string): Promise<any[]> => {
    try {
      const response = await listStatesApi(SCOPE, type, 50);
      return response.result || [];
    } catch (e) {
      console.error('Failed to fetch states from remote:', e);
      return [];
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
        loadInstances,
        addInstance,
        editInstance,
        removeInstance,
        fetchStatesFromRemote,
        isPickerVisible,
        setPickerVisible,
        isSearchVisible,
        setSearchVisible,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export const useAgentState = () => useContext(AgentContext);
