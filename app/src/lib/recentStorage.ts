import AsyncStorage from '@react-native-async-storage/async-storage';
import { Annonce } from './supabase';

const RECENT_ANNONCES_KEY = 'recent_annonces_v2';
const MAX_RECENT_ITEMS = 10;

export async function getRecentAnnonces(): Promise<Annonce[]> {
  try {
    const value = await AsyncStorage.getItem(RECENT_ANNONCES_KEY);
    if (value) {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.error('Error reading recent annonces:', error);
  }
  return [];
}

export async function addToRecent(annonce: Annonce): Promise<void> {
  try {
    const currentList = await getRecentAnnonces();
    // Supprimer l'annonce si elle existe déjà dans la liste pour la remettre en premier
    const filteredList = currentList.filter(item => item.id !== annonce.id);
    
    // Garder seulement les éléments valides et ajouter le nouveau en premier
    const newList = [annonce, ...filteredList].slice(0, MAX_RECENT_ITEMS);
    
    await AsyncStorage.setItem(RECENT_ANNONCES_KEY, JSON.stringify(newList));
  } catch (error) {
    console.error('Error saving recent annonce:', error);
  }
}

export async function clearRecentAnnonces(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_ANNONCES_KEY);
  } catch (error) {
    console.error('Error clearing recent annonces:', error);
  }
}
