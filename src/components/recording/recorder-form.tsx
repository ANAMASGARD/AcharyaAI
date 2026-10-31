import { RecorderLabeledField } from "@/components/recording/recorder-labeled-field";
import { RecorderSelectField } from "@/components/recording/recorder-select-field";
import { RecorderTextField } from "@/components/recording/recorder-text-field";
import {
  RECORDER_CLASS_LEVELS,
  RECORDER_SUBJECTS,
} from "@/data/recorder-options";

type Props = Readonly<{
  topic: string;
  subject: string;
  classLevel: string;
  isRecording: boolean;
  onTopicChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onClassLevelChange: (value: string) => void;
}>;

export function RecorderForm({
  topic,
  subject,
  classLevel,
  isRecording,
  onTopicChange,
  onSubjectChange,
  onClassLevelChange,
}: Props): React.ReactElement {
  const fieldsLocked = isRecording;

  return (
    <>
      <RecorderLabeledField label="Topic" required>
        <RecorderTextField
          editable={!fieldsLocked}
          placeholder="e.g. Gravity"
          value={topic}
          onChangeText={onTopicChange}
        />
      </RecorderLabeledField>

      <RecorderLabeledField label="Subject" required>
        <RecorderSelectField
          disabled={fieldsLocked}
          options={RECORDER_SUBJECTS}
          placeholder="Select Subject"
          value={subject}
          onValueChange={onSubjectChange}
        />
      </RecorderLabeledField>

      <RecorderLabeledField label="Class" required>
        <RecorderSelectField
          disabled={fieldsLocked}
          options={RECORDER_CLASS_LEVELS}
          placeholder="Select Class"
          value={classLevel}
          onValueChange={onClassLevelChange}
        />
      </RecorderLabeledField>
    </>
  );
}
