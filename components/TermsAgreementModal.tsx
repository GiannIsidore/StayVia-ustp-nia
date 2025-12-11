import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/theme';

interface TermsAgreementModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept: () => void;
  terms: string | null | undefined;
  propertyTitle: string;
  landlordName: string;
}

const DEFAULT_TERMS = `By inquiring about this property, you agree to:

• Provide accurate and truthful information during the rental process
• Respect the property, its facilities, and follow all house rules
• Communicate openly and promptly with the landlord
• Comply with all payment terms and schedules once the rental begins
• Notify the landlord of any issues or damages immediately
• Adhere to the occupancy limits and guest policies
• Maintain the property in good condition during your stay`;

export default function TermsAgreementModal({
  visible,
  onClose,
  onAccept,
  terms,
  propertyTitle,
  landlordName,
}: TermsAgreementModalProps) {
  const { colors } = useAppTheme();
  const [agreed, setAgreed] = useState(false);

  const displayTerms = terms && terms.trim() !== '' ? terms : DEFAULT_TERMS;
  const isCustomTerms = terms && terms.trim() !== '';

  const handleAccept = () => {
    if (!agreed) return;
    onAccept();
    // Reset agreed state for next time
    setAgreed(false);
  };

  const handleClose = () => {
    setAgreed(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>Terms & Conditions</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {propertyTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Terms Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}>
            {isCustomTerms && (
              <View style={[styles.badge, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  Custom terms set by {landlordName}
                </Text>
              </View>
            )}

            <Text style={[styles.termsText, { color: colors.foreground }]}>{displayTerms}</Text>

            {!isCustomTerms && (
              <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                  The landlord has not set custom terms. These are the default terms for inquiring
                  about properties on StayVia.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Agreement Checkbox */}
          <View style={styles.agreementSection}>
            <TouchableOpacity onPress={() => setAgreed(!agreed)} style={styles.checkboxContainer}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: agreed ? colors.primary : colors.border,
                    backgroundColor: agreed ? colors.primary : 'transparent',
                  },
                ]}>
                {agreed && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={[styles.agreementText, { color: colors.foreground }]}>
                I have read and agree to the terms and conditions
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}>
              <Text style={[styles.buttonText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAccept}
              disabled={!agreed}
              style={[
                styles.button,
                styles.acceptButton,
                {
                  backgroundColor: agreed ? colors.primary : colors.muted,
                  opacity: agreed ? 1 : 0.6,
                },
              ]}>
              <Text style={[styles.buttonText, styles.acceptButtonText]}>Accept & Inquire</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '90%',
    borderTopWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  termsText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  agreementSection: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agreementText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  acceptButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButtonText: {
    color: '#fff',
  },
});
