import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { listPublicStatesApi } from "../api/client";
import { getStateType } from "../config/stateSchemas";

interface PublicStateItem {
  id: string;
  ucode: string;
  type: string;
  title: string;
  payload?: string;
  scope?: string;
  userid?: string;
  ts?: string;
}

const TYPE_FILTERS = [
  { type: "all", label: "All", icon: "globe-outline", color: "#007AFF" },
  { type: "product", label: "Products", icon: "cube-outline", color: "#007AFF" },
  { type: "service", label: "Services", icon: "construct-outline", color: "#34C759" },
  { type: "store", label: "Stores", icon: "storefront-outline", color: "#FF9500" },
  { type: "page", label: "Pages", icon: "document-text-outline", color: "#AF52DE" },
];

export default function DiscoverScreen() {
  const [states, setStates] = useState<PublicStateItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const loadStates = useCallback(async (type?: string, q?: string) => {
    try {
      const filterType = type === "all" ? undefined : type;
      const result = await listPublicStatesApi(filterType, q || undefined, 50);
      setStates(result.result || []);
    } catch (e) {
      console.error("Failed to load public states:", e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadStates(activeFilter).finally(() => setLoading(false));
  }, []);

  // Reload when filter changes
  useEffect(() => {
    setLoading(true);
    loadStates(activeFilter, searchQuery).finally(() => setLoading(false));
  }, [activeFilter]);

  // Debounced search
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setLoading(true);
      loadStates(activeFilter, searchQuery).finally(() => setLoading(false));
    }, 400);
    setSearchTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadStates(activeFilter, searchQuery);
    setRefreshing(false);
  }, [activeFilter, searchQuery]);

  const parsePayload = (payload?: string) => {
    if (!payload) return {};
    try {
      return typeof payload === "string" ? JSON.parse(payload) : payload;
    } catch {
      return {};
    }
  };

  const renderItem = ({ item }: { item: PublicStateItem }) => {
    const typeInfo = getStateType(item.type) || {
      type: item.type,
      label: item.type,
      icon: "pricetag-outline",
      color: "#8E8E93",
    };
    const payload = parsePayload(item.payload);
    const scopeLabel = item.scope?.replace("shop:", "") || "";

    return (
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrapper, { backgroundColor: typeInfo.color + "15" }]}>
            <Ionicons name={typeInfo.icon as any} size={18} color={typeInfo.color} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title || item.ucode.split(":")[1] || item.ucode}
            </Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {typeInfo.label} · {scopeLabel}
            </Text>
          </View>
          <View style={[styles.publicBadge]}>
            <Ionicons name="globe-outline" size={11} color="#34C759" />
            <Text style={styles.publicBadgeText}>Public</Text>
          </View>
        </View>

        {/* Detail chips */}
        <View style={styles.chipRow}>
          {payload.price && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {payload.currencySymbol || payload.currency || "₹"}{payload.price}
              </Text>
            </View>
          )}
          {payload.brand && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{payload.brand}</Text>
            </View>
          )}
          {payload.sku && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{payload.sku}</Text>
            </View>
          )}
          {payload.storeName && (
            <View style={styles.chip}>
              <Ionicons name="storefront-outline" size={11} color="#636366" />
              <Text style={styles.chipText}>{payload.storeName}</Text>
            </View>
          )}
        </View>

        {/* Ucode footer */}
        <Text style={styles.cardUcode}>{item.ucode}</Text>
      </View>
    );
  };

  const renderFilterTab = (item: typeof TYPE_FILTERS[0]) => {
    const isActive = activeFilter === item.type;
    return (
      <TouchableOpacity
        key={item.type}
        style={[
          styles.filterTab,
          isActive && { backgroundColor: item.color + "15", borderColor: item.color + "40" },
        ]}
        onPress={() => setActiveFilter(item.type)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.icon as any}
          size={13}
          color={isActive ? item.color : "#8E8E93"}
        />
        <Text style={[styles.filterTabText, isActive && { color: item.color }]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrapper}>
        <Ionicons name="globe-outline" size={32} color="#AEAEB2" />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? "No results" : "No public states yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `Nothing matches "${searchQuery}"`
          : "Public products and services from all stores will appear here"}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover</Text>
        <Text style={styles.headerSubtitle}>Public catalog across all stores</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search public states..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#C7C7CC" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={TYPE_FILTERS}
          renderItem={({ item }) => renderFilterTab(item)}
          keyExtractor={(item) => item.type}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Results */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={states}
          renderItem={renderItem}
          keyExtractor={(item) => item.id || item.ucode}
          contentContainerStyle={[
            styles.listContent,
            states.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007AFF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1C1C1E",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
  },

  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1C1C1E",
    marginLeft: 8,
    paddingVertical: 0,
  },

  filterContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  filterList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F2F2F7",
    borderWidth: 1,
    borderColor: "transparent",
    marginRight: 8,
    gap: 5,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#636366",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  card: {
    backgroundColor: "#F9F9FB",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5EA",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1C1C1E",
  },
  cardMeta: {
    fontSize: 12,
    color: "#8E8E93",
    marginTop: 1,
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#34C75915",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#34C759",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEEEEF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#636366",
  },

  cardUcode: {
    fontSize: 11,
    color: "#AEAEB2",
    marginTop: 8,
    fontFamily: "monospace",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 40,
  },
});
