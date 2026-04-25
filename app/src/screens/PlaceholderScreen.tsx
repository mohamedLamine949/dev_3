import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

import { useTheme } from '../contexts/ThemeContext';

export default function PlaceholderScreen({ route, navigation }: any) {
  const { title } = route.params || { title: 'Bientôt disponible' };
  const { theme, isDark } = useTheme();

  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="construct-outline" size={64} color={theme.primary} />
        </View>
        <Text style={styles.title}>En cours de construction 🚀</Text>
        <Text style={styles.text}>
          L'écran "{title}" n'est pas encore développé. Cette fonctionnalité sera bientôt disponible dans une prochaine mise à jour !
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Retour en lieu sûr</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.borderLight,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: FONTS.lg, fontWeight: FONTS.bold, color: theme.textPrimary },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  iconContainer: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: theme.primaryFaded,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONTS.xl, fontWeight: FONTS.bold, color: theme.textPrimary,
    marginBottom: SPACING.md, textAlign: 'center'
  },
  text: {
    fontSize: FONTS.md, color: theme.textSecondary, textAlign: 'center',
    lineHeight: 24, marginBottom: SPACING.xxl,
  },
  button: {
    backgroundColor: theme.surface,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: theme.borderLight,
  },
  buttonText: {
    fontSize: FONTS.md, fontWeight: FONTS.semibold, color: theme.textPrimary
  }
});
