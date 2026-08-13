/**
 * SkeletonLoader — Composant de skeleton loading avec shimmer effect.
 *
 * Utilise uniquement l'API Animated native (pas de dépendance externe).
 * Le shimmer est un gradient animé horizontal qui donne l'impression que
 * le contenu est en cours de chargement.
 *
 * Usage :
 *   <Skeleton width={120} height={16} />
 *   <SkeletonCard />   // preset pour les cards d'annonces
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RADIUS, SPACING } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Skeleton de base
// ─────────────────────────────────────────────

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width, height, borderRadius = RADIUS.sm, style }: SkeletonProps) {
  const { theme, isDark } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  const baseColor = isDark ? '#1C2438' : '#E5E7EB';
  const shimmerColor = isDark ? '#243044' : '#F3F4F6';

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          transform: [{ translateX }],
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: shimmerColor,
            opacity: 0.5,
          }}
        />
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Preset : Card d'annonce skeleton
// ─────────────────────────────────────────────

interface SkeletonCardProps {
  cardWidth: number;
  style?: any;
}

export function SkeletonCard({ cardWidth, style }: SkeletonCardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          width: cardWidth,
          borderRadius: RADIUS.lg,
          backgroundColor: theme.surface,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Image placeholder */}
      <Skeleton width={cardWidth} height={cardWidth * 0.75} borderRadius={0} />

      {/* Content */}
      <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
        {/* Title */}
        <Skeleton width={cardWidth * 0.8} height={14} />
        <Skeleton width={cardWidth * 0.5} height={12} />

        {/* Price */}
        <Skeleton width={cardWidth * 0.45} height={18} borderRadius={RADIUS.xs} />

        {/* Meta */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs }}>
          <Skeleton width={12} height={12} borderRadius={6} />
          <Skeleton width={cardWidth * 0.5} height={10} />
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Preset : Liste skeleton (grille 2 colonnes)
// ─────────────────────────────────────────────

interface SkeletonListProps {
  count?: number;
  cardWidth: number;
  gap?: number;
}

export function SkeletonList({ count = 4, cardWidth, gap = SPACING.md }: SkeletonListProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((i) => (
        <SkeletonCard key={i} cardWidth={cardWidth} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// Preset : Skeleton pour la section catégories
// ─────────────────────────────────────────────

export function SkeletonCategories() {
  return (
    <View style={{ flexDirection: 'row', gap: SPACING.sm, paddingBottom: SPACING.xl }}>
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          width={90}
          height={36}
          borderRadius={RADIUS.full}
        />
      ))}
    </View>
  );
}

export default Skeleton;
