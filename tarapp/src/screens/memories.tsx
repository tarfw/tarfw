import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAgentState } from "@/hooks/useAgentState";
import { StateTypePickerModal } from "@/components/StateTypePickerModal";
import { StateFormModal } from "@/components/StateFormModal";
import {
  STATE_TYPES,
  StateTypeDef,
  getStateType,
} from "../config/stateSchemas";

export default function MemoriesScreen() {
  const {
    loading,
    result,
    createState,
    updateState,
    deleteState,
    loadStates,
    search,
  } = useAgentState();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<StateTypeDef | null>(null);
  const [editingState, setEditingState] = useState<any>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // --- CRUD Handlers ---
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStates();
    setRefreshing(false);
  }, [loadStates]);

  const handlePressAdd = () => {
    setEditingState(null);
    setShowTypePicker(true);
  };

  const handleTypeSelect = (type: StateTypeDef) => {
    setSelectedType(type);
    setShowTypePicker(false);
    setShowForm(true);
  };



  const handleSubmit = async (
    ucode: string,
    title: string,
    payload: Record<string, any>,
  ) => {
    if (editingState) {
      await updateState(ucode, title, payload);
    } else {
      await createState(ucode, title, payload);
    }
  };

  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!text) {
      loadStates();
      return;
    }

    if (isSemanticSearch) {
      searchTimerRef.current = setTimeout(() => {
        search(text);
      }, 300);
    }
  };

  const toggleSearchMode = () => {
    const nextMode = !isSemanticSearch;
    setIsSemanticSearch(nextMode);
    if (searchQuery) {
      if (nextMode) {
        search(searchQuery);
      } else {
        // Keyword filter happens automatically via filteredItems
      }
    }
  };

  // --- Derive items list ---
  let items: any[] = [];
  if (
    result?.result?.action === "SEARCH" &&
    Array.isArray(result.result.results)
  ) {
    items = result.result.results;
  } else if (Array.isArray(result?.result)) {
    items = result.result;
  } else if (
    result?.result &&
    typeof result.result === "object" &&
    result.result.ucode
  ) {
    items = [result.result];
  }

  const filteredItems = isSemanticSearch
    ? items // In semantic mode, 'items' are already filtered by the 'search' hook results
    : items.filter((item) => {
        const matchesType =
          !activeTypeFilter ||
          (item.ucode || item.streamid)?.startsWith(activeTypeFilter + ":");
        const matchesQuery =
          !searchQuery ||
          item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.ucode?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesQuery;
      });

  // --- Render ---
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="albums-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyText}>No memories yet</Text>
      <Text style={styles.emptySubText}>
        Tap + to create your first state — products, brands, campaigns and more.
      </Text>
      <TouchableOpacity style={styles.emptyButton} onPress={handlePressAdd}>
        <Ionicons
          name="add"
          size={18}
          color="#FFF"
          style={{ marginRight: 6 }}
        />
        <Text style={styles.emptyButtonText}>Create Memory</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTypeFilters = () => (
    <View style={styles.tabBarContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        <TouchableOpacity
          style={[styles.tab, !activeTypeFilter && styles.tabActive]}
          onPress={() => setActiveTypeFilter(null)}
        >
          <Text
            style={[styles.tabText, !activeTypeFilter && styles.tabTextActive]}
          >
            All
          </Text>
          {!activeTypeFilter && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        {STATE_TYPES.map((t) => {
          const isActive = activeTypeFilter === t.type;
          return (
            <TouchableOpacity
              key={t.type}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTypeFilter(isActive ? null : t.type)}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={isActive ? t.color : "#8E8E93"}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.tabText,
                  isActive && { color: t.color, fontWeight: "700" },
                ]}
              >
                {t.label}
              </Text>
              {isActive && (
                <View
                  style={[styles.tabIndicator, { backgroundColor: t.color }]}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderCard = (item: any, i: number) => {
    const ucode = item.ucode || item.streamid;
    const typeKey = ucode?.split(":")[0];
    const typeDef = getStateType(typeKey);
    const parsedPayload = item.payload
      ? typeof item.payload === "string"
        ? JSON.parse(item.payload)
        : item.payload
      : {};

    return (
      <View key={i} style={styles.card}>
        {/* Type tag + actions row */}
        <View style={styles.cardTop}>
          {typeDef ? (
            <View
              style={[
                styles.typeTag,
                { backgroundColor: typeDef.color + "18" },
              ]}
            >
              <Ionicons
                name={typeDef.icon as any}
                size={13}
                color={typeDef.color}
              />
              <Text style={[styles.typeTagText, { color: typeDef.color }]}>
                {typeDef.label}
              </Text>
            </View>
          ) : (
            <View style={styles.typeTag}>
              <Text style={styles.typeTagText}>{typeKey}</Text>
            </View>
          )}

        </View>

        {/* Title & Distance */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title || "—"}</Text>
            <Text style={styles.cardUcode}>{ucode}</Text>
          </View>
          {isSemanticSearch && typeof item.distance === 'number' && (
            <View style={styles.distanceBadge}>
              <Ionicons name="git-branch-outline" size={10} color="#007AFF" />
              <Text style={styles.distanceText}>{item.distance.toFixed(3)}</Text>
            </View>
          )}
        </View>

        {/* Key payload fields preview */}
        {Object.keys(parsedPayload).length > 0 && (
          <View style={styles.payloadRow}>
            {Object.entries(parsedPayload)
              .slice(0, 3)
              .map(([key, val]) => (
                <View key={key} style={styles.payloadChip}>
                  <Text style={styles.payloadChipKey}>{key}</Text>
                  <Text style={styles.payloadChipVal} numberOfLines={1}>
                    {String(val)}
                  </Text>
                </View>
              ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Memories</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <TouchableOpacity style={styles.addBtn} onPress={onRefresh}>
            <Ionicons name="sync" size={20} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handlePressAdd}>
            <Ionicons name="add" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={18}
            color="#8E8E93"
            style={{ marginLeft: 12 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={
              isSemanticSearch ? "Search by meaning..." : "Search memories..."
            }
            value={searchQuery}
            onChangeText={handleSearch}
            placeholderTextColor="#8E8E93"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => handleSearch("")}
              style={{ padding: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#C7C7CC" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.aiToggle, isSemanticSearch && styles.aiToggleActive]}
          onPress={toggleSearchMode}
        >
          <Text
            style={[
              styles.aiToggleText,
              isSemanticSearch && styles.aiToggleTextActive,
            ]}
          >
            AI
          </Text>
        </TouchableOpacity>
      </View>

      {/* Type filter chips */}
      {items.length > 0 && renderTypeFilters()}

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          filteredItems.length === 0 && { flex: 1 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#000" />
            <Text style={styles.loadingText}>Working…</Text>
          </View>
        )}

        {(!loading || refreshing) &&
          filteredItems.length === 0 &&
          renderEmpty()}

        {filteredItems.length > 0 && (
          <View style={styles.list}>
            {filteredItems.map((item, i) => renderCard(item, i))}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <StateTypePickerModal
        visible={showTypePicker}
        onClose={() => setShowTypePicker(false)}
        onSelect={handleTypeSelect}
      />
      <StateFormModal
        visible={showForm}
        stateType={selectedType}
        existingState={editingState}
        onClose={() => {
          setShowForm(false);
          setEditingState(null);
        }}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1C1E",
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
  },

  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1C1C1E",
    paddingHorizontal: 8,
  },
  aiToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#007AFF10",
    borderWidth: 1,
    borderColor: "#007AFF30",
    minWidth: 50,
  },
  aiToggleActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  aiToggleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#007AFF",
  },
  aiToggleTextActive: {
    color: "#FFF",
  },

  tabBarContainer: {
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F2F7",
    backgroundColor: "#FFF",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    height: '100%',
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: '100%',
    position: "relative",
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  tabTextActive: {
    color: "#1C1C1E",
    fontWeight: "700",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#1C1C1E",
  },

  scrollContent: { padding: 20, paddingBottom: 160 },

  loadingContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
  },
  loadingText: { fontSize: 14, color: "#8E8E93" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8E8E93",
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyButtonText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  list: { gap: 12 },

  card: {
    backgroundColor: "#F8F8F8",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5EA",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  typeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "#EDEDF0",
  },
  typeTagText: { fontSize: 12, fontWeight: "600", color: "#636366" },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 2,
  },
  cardUcode: { fontSize: 12, color: "#AEAEB2", marginBottom: 10 },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#007AFF10',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF20'
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: 'monospace'
  },

  payloadRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  payloadChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDEDF0",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    maxWidth: 160,
  },
  payloadChipKey: {
    fontSize: 11,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
  },
  payloadChipVal: {
    fontSize: 12,
    color: "#1C1C1E",
    fontWeight: "500",
    flexShrink: 1,
  },
});
