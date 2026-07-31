export interface UploadImageRequestDto {
  /// Data URI ("data:image/jpeg;base64,...") from the browser's
  /// FileReader.readAsDataURL(), same format already used for the old
  /// inline-base64 fields.
  image: string;
  /// Which feature this upload belongs to - becomes a Cloudinary
  /// sub-folder, e.g. "students", "teachers", "branding".
  folder?: string;
}

export interface DeleteImageRequestDto {
  public_id: string;
}
