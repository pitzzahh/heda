export type LabelValuePair<T> = { label: keyof T; value: T[keyof T] };
export type LabelKeyPair<T> = {
  label: keyof T;
  key: string;
};