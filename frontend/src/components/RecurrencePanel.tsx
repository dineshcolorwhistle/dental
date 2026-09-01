import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

type RecurrenceType = 'ONE_TIME' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
type EndType = 'ON_DATE' | 'AFTER' | 'NEVER';
type MonthlyPattern = 'DAY_OF_MONTH' | 'POSITIONAL_WEEKDAY';
type MonthPosition = 'FIRST' | 'SECOND' | 'THIRD' | 'FOURTH' | 'LAST';

export interface RecurrencePanelProps {
  recurrence: RecurrenceType;
  repeatInterval: number;
  endType: EndType;
  endDate: string;
  endAfterOccurrences: number;
  weeklyDays: number[];
  monthlyPattern: MonthlyPattern;
  monthlyDayOfMonth: number;
  monthlyWeekPosition: MonthPosition;
  monthlyWeekDay: number;
  errors: Record<string, string>;
  disabled: boolean;
  minDate?: string;
  maxDate?: string;
  onChange: (field: string, value: number | string | number[]) => void;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTH_POSITIONS: MonthPosition[] = ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'LAST'];

export function RecurrencePanel({
  recurrence,
  repeatInterval,
  endType,
  endDate,
  endAfterOccurrences,
  weeklyDays,
  monthlyPattern,
  monthlyDayOfMonth,
  monthlyWeekPosition,
  monthlyWeekDay,
  errors,
  disabled,
  minDate,
  maxDate,
  onChange,
}: RecurrencePanelProps) {
  const { t } = useTranslation();

  if (recurrence === 'ONE_TIME') return null;

  const unitKey =
    recurrence === 'DAILY'
      ? 'days'
      : recurrence === 'WEEKLY'
        ? 'weeks'
        : recurrence === 'MONTHLY'
          ? 'months'
          : 'years';

  const toggleWeekday = (day: number) => {
    const newDays = weeklyDays.includes(day)
      ? weeklyDays.filter((d) => d !== day)
      : [...weeklyDays, day].sort((a, b) => a - b);
    onChange('weeklyDays', newDays);
  };

  return (
    <div className="recurrence-panel">
      {/* ── Repeat Every ─────────────────────────────── */}
      <div className="recurrence-panel__section">
        <label className="recurrence-panel__section-label">
          {t('reminders.recurrencePanel.repeatEvery', { defaultValue: 'Repeat every' })}
        </label>
        <div className="recurrence-panel__interval-row">
          <input
            type="number"
            className={`form-input recurrence-panel__interval-input ${errors.repeatInterval ? 'form-input--error' : ''}`}
            min={1}
            value={repeatInterval}
            onChange={(e) => onChange('repeatInterval', Math.max(1, parseInt(e.target.value) || 1))}
            disabled={disabled}
          />
          <span className="recurrence-panel__unit-label">
            {t(`reminders.recurrencePanel.${unitKey}`, { defaultValue: unitKey })}
          </span>
        </div>
        {errors.repeatInterval && (
          <span className="form-error">
            <AlertCircle size={12} /> {errors.repeatInterval}
          </span>
        )}
      </div>

      {/* ── Weekly: Day Buttons ───────────────────────── */}
      {recurrence === 'WEEKLY' && (
        <div className="recurrence-panel__section">
          <label className="recurrence-panel__section-label">
            {t('reminders.recurrencePanel.repeatOn', { defaultValue: 'Repeat on' })}
          </label>
          <div className="recurrence-weekdays">
            {WEEKDAY_KEYS.map((key, index) => (
              <button
                key={key}
                type="button"
                className={`recurrence-weekday-btn ${weeklyDays.includes(index) ? 'recurrence-weekday-btn--active' : ''}`}
                onClick={() => toggleWeekday(index)}
                disabled={disabled}
              >
                {t(`reminders.recurrencePanel.weekdays.${key}`, { defaultValue: key.charAt(0).toUpperCase() + key.slice(1) })}
              </button>
            ))}
          </div>
          {errors.weeklyDays && (
            <span className="form-error" style={{ marginTop: '4px' }}>
              <AlertCircle size={12} /> {errors.weeklyDays}
            </span>
          )}
        </div>
      )}

      {/* ── Monthly: Pattern Radio ───────────────────── */}
      {recurrence === 'MONTHLY' && (
        <div className="recurrence-panel__section">
          <label className="recurrence-panel__section-label">
            {t('reminders.fields.recurrence', { defaultValue: 'Pattern' })}
          </label>
          <div className="recurrence-options-list">
            {/* Option 1: On day N of the month */}
            <div
              className={`recurrence-option-row ${monthlyPattern === 'DAY_OF_MONTH' ? 'recurrence-option-row--active' : ''}`}
              onClick={() => !disabled && onChange('monthlyPattern', 'DAY_OF_MONTH')}
            >
              <div className="recurrence-radio-wrapper">
                <input
                  type="radio"
                  name="monthlyPattern"
                  className="recurrence-radio-input"
                  checked={monthlyPattern === 'DAY_OF_MONTH'}
                  onChange={() => onChange('monthlyPattern', 'DAY_OF_MONTH')}
                  disabled={disabled}
                />
              </div>
              <span className="recurrence-option-label">
                {t('reminders.recurrencePanel.onDay', { defaultValue: 'On day' })}
              </span>
              <div className="recurrence-option-controls" onClick={(e) => e.stopPropagation()}>
                <input
                  type="number"
                  className={`form-input recurrence-panel__small-input ${errors.monthlyDayOfMonth ? 'form-input--error' : ''}`}
                  style={{ width: '64px' }}
                  min={1}
                  max={31}
                  value={monthlyDayOfMonth}
                  onChange={(e) => onChange('monthlyDayOfMonth', Math.max(1, Math.min(31, parseInt(e.target.value) || 1)))}
                  disabled={disabled || monthlyPattern !== 'DAY_OF_MONTH'}
                />
                <span className="recurrence-option-suffix">
                  {t('reminders.recurrencePanel.ofTheMonth', { defaultValue: 'of the month' })}
                </span>
              </div>
            </div>

            {/* Option 2: On the [Position] [Weekday] */}
            <div
              className={`recurrence-option-row ${monthlyPattern === 'POSITIONAL_WEEKDAY' ? 'recurrence-option-row--active' : ''}`}
              onClick={() => !disabled && onChange('monthlyPattern', 'POSITIONAL_WEEKDAY')}
            >
              <div className="recurrence-radio-wrapper">
                <input
                  type="radio"
                  name="monthlyPattern"
                  className="recurrence-radio-input"
                  checked={monthlyPattern === 'POSITIONAL_WEEKDAY'}
                  onChange={() => onChange('monthlyPattern', 'POSITIONAL_WEEKDAY')}
                  disabled={disabled}
                />
              </div>
              <span className="recurrence-option-label">
                {t('reminders.recurrencePanel.onThe', { defaultValue: 'On the' })}
              </span>
              <div className="recurrence-option-controls" onClick={(e) => e.stopPropagation()}>
                <select
                  className="form-input recurrence-panel__select"
                  value={monthlyWeekPosition}
                  onChange={(e) => onChange('monthlyWeekPosition', e.target.value)}
                  disabled={disabled || monthlyPattern !== 'POSITIONAL_WEEKDAY'}
                >
                  {MONTH_POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {t(`reminders.recurrencePanel.monthPositions.${pos}`, { defaultValue: pos })}
                    </option>
                  ))}
                </select>
                <select
                  className="form-input recurrence-panel__select"
                  value={monthlyWeekDay}
                  onChange={(e) => onChange('monthlyWeekDay', parseInt(e.target.value))}
                  disabled={disabled || monthlyPattern !== 'POSITIONAL_WEEKDAY'}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                    <option key={day} value={day}>
                      {t(`reminders.recurrencePanel.weekdayNames.${day}`, { defaultValue: `Day ${day}` })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {(errors.monthlyDayOfMonth || errors.monthlyWeekPosition || errors.monthlyWeekDay) && (
            <span className="form-error" style={{ marginTop: '4px' }}>
              <AlertCircle size={12} /> {errors.monthlyDayOfMonth || errors.monthlyWeekPosition || errors.monthlyWeekDay}
            </span>
          )}
        </div>
      )}

      {/* ── Ends Section ─────────────────────────────── */}
      <div className="recurrence-panel__section">
        <label className="recurrence-panel__section-label">
          {t('reminders.recurrencePanel.ends', { defaultValue: 'Ends' })}
        </label>
        <div className="recurrence-options-list">
          {/* Option 1: On date */}
          <div
            className={`recurrence-option-row ${endType === 'ON_DATE' ? 'recurrence-option-row--active' : ''}`}
            onClick={() => !disabled && onChange('endType', 'ON_DATE')}
          >
            <div className="recurrence-radio-wrapper">
              <input
                type="radio"
                name="endType"
                className="recurrence-radio-input"
                checked={endType === 'ON_DATE'}
                onChange={() => onChange('endType', 'ON_DATE')}
                disabled={disabled}
              />
            </div>
            <span className="recurrence-option-label">
              {t('reminders.recurrencePanel.onDate', { defaultValue: 'On date' })}
            </span>
            <div className="recurrence-option-controls" onClick={(e) => e.stopPropagation()}>
              <input
                type="date"
                className={`form-input recurrence-panel__date-input ${errors.endDate ? 'form-input--error' : ''}`}
                value={endDate}
                min={minDate}
                max={maxDate}
                onChange={(e) => onChange('endDate', e.target.value)}
                disabled={disabled || endType !== 'ON_DATE'}
              />
            </div>
          </div>

          {/* Option 2: After N occurrences */}
          <div
            className={`recurrence-option-row ${endType === 'AFTER' ? 'recurrence-option-row--active' : ''}`}
            onClick={() => !disabled && onChange('endType', 'AFTER')}
          >
            <div className="recurrence-radio-wrapper">
              <input
                type="radio"
                name="endType"
                className="recurrence-radio-input"
                checked={endType === 'AFTER'}
                onChange={() => onChange('endType', 'AFTER')}
                disabled={disabled}
              />
            </div>
            <span className="recurrence-option-label">
              {t('reminders.recurrencePanel.after', { defaultValue: 'After' })}
            </span>
            <div className="recurrence-option-controls" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                className={`form-input recurrence-panel__small-input ${errors.endAfterOccurrences ? 'form-input--error' : ''}`}
                style={{ width: '64px' }}
                min={1}
                max={365}
                value={endAfterOccurrences}
                onChange={(e) => onChange('endAfterOccurrences', Math.max(1, parseInt(e.target.value) || 1))}
                disabled={disabled || endType !== 'AFTER'}
              />
              <span className="recurrence-option-suffix">
                {t('reminders.recurrencePanel.occurrences', { defaultValue: 'occurrences' })}
              </span>
            </div>
          </div>

          {/* Option 3: Never */}
          <div
            className={`recurrence-option-row ${endType === 'NEVER' ? 'recurrence-option-row--active' : ''}`}
            onClick={() => !disabled && onChange('endType', 'NEVER')}
          >
            <div className="recurrence-radio-wrapper">
              <input
                type="radio"
                name="endType"
                className="recurrence-radio-input"
                checked={endType === 'NEVER'}
                onChange={() => onChange('endType', 'NEVER')}
                disabled={disabled}
              />
            </div>
            <span className="recurrence-option-label">
              {t('reminders.recurrencePanel.never', { defaultValue: 'Never' })}
            </span>
          </div>
        </div>

        {(errors.endDate || errors.endAfterOccurrences) && (
          <span className="form-error" style={{ marginTop: '4px' }}>
            <AlertCircle size={12} /> {errors.endDate || errors.endAfterOccurrences}
          </span>
        )}
      </div>

      {/* ── Helper Text ──────────────────────────────── */}
      <p className="recurrence-panel__helper">
        {t('reminders.recurrencePanel.helperText', {
          defaultValue:
            'Choose how often this reminder repeats, which days it uses, and when the series should stop. Limited to 365 upcoming occurrences, and never beyond 3 years from today.',
        })}
      </p>
    </div>
  );
}
