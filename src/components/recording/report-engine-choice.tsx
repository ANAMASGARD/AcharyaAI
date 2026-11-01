import { Text, View } from 'react-native';
import { NeoButton } from '@/components/ui/neo-button';
import { useThemeColors } from '@/theme/use-theme';
import type { ReportBackend } from '@/lib/reports/generate';
export function ReportEngineChoice({ backend, disabled, onChange }: { backend: ReportBackend; disabled: boolean; onChange: (backend: ReportBackend) => void }) {
  const colors = useThemeColors();
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.foreground }}>{backend === 'offline' ? 'Report: Gemma on this phone · Experimental' : 'Report: online provider'}</Text>
    <NeoButton label={backend === 'offline' ? 'Use online report instead' : 'Use offline Gemma instead'} disabled={disabled}
      onPress={() => onChange(backend === 'offline' ? 'online' : 'offline')} />
  </View>;
}
