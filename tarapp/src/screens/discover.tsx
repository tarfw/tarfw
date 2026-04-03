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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#000000",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666666",
    marginTop: 4,
    fontWeight: "400",
  },

  searchWrapper: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 0,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: "#FAFAFA",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#000000",
    marginLeft: 8,
    paddingVertical: 0,
  },

  filterContainer: {
    marginBottom: 10,
  },
  filterList: {
    paddingHorizontal: 20,
    paddingVertical: 4,
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    gap: 6,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666666",
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  listContentEmpty: {
    flex: 1,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 0,
    padding: 0,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
    paddingBottom: 24,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: "#666666",
  },
  publicBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  publicBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    paddingLeft: 52, // Align with text
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 0,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333333",
  },

  cardUcode: {
    fontSize: 11,
    color: "#999999",
    marginTop: 16,
    paddingLeft: 52,
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
    paddingTop: 80,
  },
  emptyIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 0,
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
