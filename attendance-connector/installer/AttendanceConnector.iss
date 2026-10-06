; Attendance Connector (ZKTeco K40 -> cloud) - Inno Setup 6 script (requires Inno Setup >= 6.3, Unicode).
; This file is saved as UTF-8 WITH BOM so the Bangla strings survive compilation - keep the BOM when editing.
;
; Build (from attendance-connector\):
;   npm ci ; npm run package                     -> release\connector.exe
;   "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" installer\AttendanceConnector.iss
;   -> installer\output\AttendanceConnectorSetup.exe
; Optional: ISCC /DAppVersion=1.2.0 installer\AttendanceConnector.iss
;
; Flow:
;   1. Wizard page asks for the pairing code from the admin panel (ADC1.<base64url>). On upgrade, when
;      config.json already exists, the code may be left empty to keep the existing setup.
;   2. PrepareToInstall: stops/removes an existing task + connector processes (old uninstall-service.ps1)
;      so connector.exe is not locked.
;   3. Files are copied to {autopf}\AttendanceConnector.
;   4. ssPostInstall: "connector.exe setup" runs hidden with the code passed in env PAIRING_TOKEN (not on the
;      command line, so it does not show up in process listings). Non-zero exit -> error dialog with the CLI
;      output and the option to enter another code. If the user gives up: fresh install = rolled back
;      (uninstaller is started when the wizard closes), upgrade = previous config kept.
;   5. Optional "connector.exe test-device" (result shown, never fatal).
;   6. install-service.ps1 -Quiet registers the SYSTEM startup task and starts it.
;
; Security notes:
;   * config.json, data\ (queue), logs\ and secrets\ live next to the exe under Program Files. The task runs as
;     SYSTEM, which has full control there, so writing is fine. Normal users only get read access (inherited
;     Program Files ACL) - they cannot tamper with config or queue.
;   * secrets\device.key is DPAPI-protected in LocalMachine scope, which ANY local account could decrypt. Therefore
;     install-service.ps1 strips inheritance on secrets\ and grants only SYSTEM + Administrators (icacls with SIDs).
;   * Silent install: AttendanceConnectorSetup.exe /VERYSILENT /PAIRINGCODE=ADC1.xxxx  (note: a code given on the
;     command line IS visible in process listings - only for scripted admin deployments).

#ifndef AppVersion
  #define AppVersion "1.1.0"
#endif
#define AppName "Attendance Connector"
#define AppExe "connector.exe"

[Setup]
; Fixed AppId - never change it, upgrades/uninstall rely on it.
AppId={{17B21D8F-0DCD-4A5C-A12B-EF8B644CDEF3}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=Madrasha
AppPublisherURL=https://github.com/mdjunaidalhabib/madrasha
VersionInfoVersion={#AppVersion}
DefaultDirName={autopf}\AttendanceConnector
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=output
OutputBaseFilename=AttendanceConnectorSetup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
UninstallDisplayName={#AppName}
UninstallDisplayIcon={app}\{#AppExe}
; our PrepareToInstall stops the running connector itself
CloseApplications=no
; Code signing placeholder (configure a SignTool in the IDE/ISCC /S and uncomment):
; SignTool=signtool sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /f $qcert.pfx$q /p $qPASSWORD$q $f

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Dirs]
; kept on uninstall (queue with unsent punches + logs)
Name: "{app}\data"; Flags: uninsneveruninstall
Name: "{app}\logs"; Flags: uninsneveruninstall

[Files]
Source: "..\release\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\run.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\install-service.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\uninstall-service.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\config.example.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "README-install.txt"; DestDir: "{app}"; Flags: ignoreversion isreadme

[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File ""{app}\uninstall-service.ps1"" -Quiet"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveConnectorTask"

[UninstallDelete]
; data\ and logs\ are intentionally kept. Everything created at runtime except those is removed.
Type: files; Name: "{app}\config.json"
Type: files; Name: "{app}\node-path.txt"
Type: filesandordirs; Name: "{app}\secrets"

[Code]
var
  PairPage: TInputQueryPage;
  TestCheck: TNewCheckBox;
  UpgradeNote: TNewStaticText;
  HadConfig: Boolean;
  RollbackFresh: Boolean;
  SetupFailedText: String;
  UninstallerPath: String;

function SetEnvironmentVariable(lpName: String; lpValue: String): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

function PowerShellExe: String;
begin
  Result := ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe');
end;

function IsValidPairingCode(const S: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := False;
  if Length(S) <= 5 then Exit;
  if Copy(S, 1, 5) <> 'ADC1.' then Exit;
  for I := 6 to Length(S) do
  begin
    C := S[I];
    if not (((C >= 'A') and (C <= 'Z')) or ((C >= 'a') and (C <= 'z')) or ((C >= '0') and (C <= '9')) or
            (C = '-') or (C = '_') or (C = '=') or (C = '.')) then Exit;
  end;
  Result := True;
end;

{ Runs Exe hidden via cmd.exe, stdin from nul (so nothing can ever wait for input), stdout+stderr to LogFile.
  Returns the exit code (-1 if it could not be started); Output = last 25 lines. }
function RunCaptured(const Exe, Params, WorkDir, LogFile: String; var Output: String): Integer;
var
  RC, I, First: Integer;
  Lines: TArrayOfString;
  Cmd: String;
begin
  Output := '';
  DeleteFile(LogFile);
  Cmd := '/S /C ""' + Exe + '" ' + Params + ' < nul > "' + LogFile + '" 2>&1"';
  if not Exec(ExpandConstant('{cmd}'), Cmd, WorkDir, SW_HIDE, ewWaitUntilTerminated, RC) then
    Result := -1
  else
    Result := RC;
  if LoadStringsFromFile(LogFile, Lines) then
  begin
    First := GetArrayLength(Lines) - 25;
    if First < 0 then First := 0;
    for I := First to GetArrayLength(Lines) - 1 do
      Output := Output + Lines[I] + #13#10;
  end;
  Log('Ran: ' + Exe + ' ' + Params + ' -> exit ' + IntToStr(Result));
end;

procedure AppendInstallerLog(const Title, Text: String);
begin
  SaveStringToFile(ExpandConstant('{app}\logs\installer.log'),
    '[' + GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '] ' + Title + #13#10 + Text + #13#10, True);
end;

procedure InitializeWizard;
begin
  PairPage := CreateInputQueryPage(wpSelectDir,
    'পেয়ারিং কোড (Pairing code)',
    'অ্যাডমিন প্যানেল থেকে পাওয়া পেয়ারিং কোড দিন (Enter the pairing code from the admin panel)',
    'অ্যাডমিন প্যানেল > হাজিরা ডিভাইস থেকে কোডটি কপি করে নিচে পেস্ট করুন। কোডটি ADC1. দিয়ে শুরু হয়।' + #13#10 +
    '(Copy the code from Admin panel > Attendance devices. It starts with ADC1.)');
  PairPage.Add('অ্যাডমিন প্যানেল থেকে পাওয়া পেয়ারিং কোড (Pairing code):', False);
  PairPage.Values[0] := ExpandConstant('{param:PAIRINGCODE|}');

  TestCheck := TNewCheckBox.Create(PairPage);
  TestCheck.Parent := PairPage.Surface;
  TestCheck.Top := PairPage.Edits[0].Top + PairPage.Edits[0].Height + ScaleY(16);
  TestCheck.Left := 0;
  TestCheck.Width := PairPage.SurfaceWidth;
  TestCheck.Height := ScaleY(17);
  TestCheck.Caption := 'ইনস্টলের পর K40 ডিভাইসের সংযোগ পরীক্ষা করুন (Test the K40 connection after install)';
  TestCheck.Checked := True;

  UpgradeNote := TNewStaticText.Create(PairPage);
  UpgradeNote.Parent := PairPage.Surface;
  UpgradeNote.Left := 0;
  UpgradeNote.Top := TestCheck.Top + TestCheck.Height + ScaleY(16);
  UpgradeNote.Width := PairPage.SurfaceWidth;
  UpgradeNote.AutoSize := False;
  UpgradeNote.WordWrap := True;
  UpgradeNote.Height := ScaleY(60);
  UpgradeNote.Font.Style := [fsBold];
  UpgradeNote.Caption :=
    'এই কম্পিউটারে আগের সেটআপ পাওয়া গেছে। আগের সেটআপ রাখতে ঘরটি খালি রাখুন, নতুন করে জোড়া দিতে নতুন কোড দিন।' + #13#10 +
    '(An existing setup was found. Leave the code empty to keep it, or enter a new code to re-pair.)';
  UpgradeNote.Visible := False;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = PairPage.ID then
  begin
    HadConfig := FileExists(AddBackslash(WizardDirValue) + 'config.json');
    UpgradeNote.Visible := HadConfig;
  end;
  if (CurPageID = wpFinished) and (SetupFailedText <> '') then
    WizardForm.FinishedLabel.Caption := SetupFailedText;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Code: String;
begin
  Result := True;
  if CurPageID = PairPage.ID then
  begin
    HadConfig := FileExists(AddBackslash(WizardDirValue) + 'config.json');
    Code := Trim(PairPage.Values[0]);
    PairPage.Values[0] := Code;
    if Code = '' then
    begin
      if not HadConfig then
      begin
        SuppressibleMsgBox('পেয়ারিং কোড দিন।' + #13#10 + '(Please enter the pairing code.)', mbError, MB_OK, IDOK);
        Result := False;
      end;
    end
    else if not IsValidPairingCode(Code) then
    begin
      SuppressibleMsgBox('পেয়ারিং কোডটি সঠিক নয়: কোডটি ADC1. দিয়ে শুরু হতে হবে। পুরো কোডটি কপি করেছেন কিনা দেখুন।' + #13#10 +
        '(Invalid pairing code: it must start with ADC1. - check that you copied the whole code.)', mbError, MB_OK, IDOK);
      Result := False;
    end;
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Dir, Output: String;
begin
  Result := '';
  Dir := AddBackslash(WizardDirValue);
  HadConfig := FileExists(Dir + 'config.json');
  { upgrade: stop the old task + connector so connector.exe is not locked. No -Quiet here: an older
    uninstall-service.ps1 may not know that switch (output is hidden anyway). }
  if FileExists(Dir + 'uninstall-service.ps1') then
    RunCaptured(PowerShellExe, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + Dir + 'uninstall-service.ps1"',
      Dir, ExpandConstant('{tmp}\stop-old.txt'), Output);
end;

{ Small modal dialog: shows the error output and asks for another code. False = user gave up. }
function AskPairingCodeAgain(const ErrText: String; var Code: String): Boolean;
var
  Form: TSetupForm;
  Info: TNewStaticText;
  Memo: TNewMemo;
  Edit: TNewEdit;
  OkBtn, CancelBtn: TNewButton;
begin
  Result := False;
  if WizardSilent then Exit;
  Form := CreateCustomForm;
  try
    Form.ClientWidth := ScaleX(520);
    Form.ClientHeight := ScaleY(330);
    Form.Caption := 'পেয়ারিং ব্যর্থ (Pairing failed)';

    Info := TNewStaticText.Create(Form);
    Info.Parent := Form;
    Info.Left := ScaleX(12);
    Info.Top := ScaleY(10);
    Info.Width := Form.ClientWidth - ScaleX(24);
    Info.AutoSize := False;
    Info.WordWrap := True;
    Info.Height := ScaleY(48);
    Info.Caption := 'কানেক্টর সেটআপ ব্যর্থ হয়েছে (নিচে বিস্তারিত)। কোড ভুল, মেয়াদোত্তীর্ণ বা আগে ব্যবহৃত হতে পারে, অথবা ইন্টারনেট নেই। ' +
      'অ্যাডমিন প্যানেল থেকে নতুন কোড নিয়ে আবার চেষ্টা করুন।' + #13#10 +
      '(Connector setup failed - see details. Get a new code from the admin panel and retry.)';

    Memo := TNewMemo.Create(Form);
    Memo.Parent := Form;
    Memo.Left := ScaleX(12);
    Memo.Top := Info.Top + Info.Height + ScaleY(6);
    Memo.Width := Form.ClientWidth - ScaleX(24);
    Memo.Height := ScaleY(170);
    Memo.ReadOnly := True;
    Memo.ScrollBars := ssVertical;
    Memo.Text := ErrText;

    Edit := TNewEdit.Create(Form);
    Edit.Parent := Form;
    Edit.Left := ScaleX(12);
    Edit.Top := Memo.Top + Memo.Height + ScaleY(10);
    Edit.Width := Form.ClientWidth - ScaleX(24);
    Edit.Text := Code;

    OkBtn := TNewButton.Create(Form);
    OkBtn.Parent := Form;
    OkBtn.Width := ScaleX(110);
    OkBtn.Height := ScaleY(25);
    OkBtn.Left := Form.ClientWidth - ScaleX(12 + 110 + 8 + 110);
    OkBtn.Top := Form.ClientHeight - ScaleY(25 + 10);
    OkBtn.Caption := 'আবার চেষ্টা (Retry)';
    OkBtn.ModalResult := mrOk;
    OkBtn.Default := True;

    CancelBtn := TNewButton.Create(Form);
    CancelBtn.Parent := Form;
    CancelBtn.Width := ScaleX(110);
    CancelBtn.Height := ScaleY(25);
    CancelBtn.Left := Form.ClientWidth - ScaleX(12 + 110);
    CancelBtn.Top := OkBtn.Top;
    CancelBtn.Caption := 'বাতিল (Cancel)';
    CancelBtn.ModalResult := mrCancel;
    CancelBtn.Cancel := True;

    Form.ActiveControl := Edit;
    while True do
    begin
      if Form.ShowModal <> mrOk then Exit;
      Code := Trim(Edit.Text);
      if IsValidPairingCode(Code) then Break;
      MsgBox('পেয়ারিং কোডটি ADC1. দিয়ে শুরু হতে হবে।' + #13#10 + '(The pairing code must start with ADC1.)', mbError, MB_OK);
    end;
    Result := True;
  finally
    Form.Free;
  end;
end;

{ connector.exe setup with the code in env PAIRING_TOKEN (kept out of the command line). }
function RunPairing(const App, Code: String; var Output: String): Integer;
begin
  SetEnvironmentVariable('PAIRING_TOKEN', Code);
  try
    Result := RunCaptured(App + '\{#AppExe}', 'setup', App, ExpandConstant('{tmp}\setup-output.txt'), Output);
  finally
    SetEnvironmentVariable('PAIRING_TOKEN', '');
  end;
  AppendInstallerLog('connector setup -> exit ' + IntToStr(Result), Output);
end;

procedure SetStatus(const S: String);
begin
  WizardForm.StatusLabel.Caption := S;
  WizardForm.FilenameLabel.Caption := '';
end;

procedure DoPostInstall;
var
  App, Code, Output: String;
  RC: Integer;
  Configured: Boolean;
begin
  App := ExpandConstant('{app}');
  UninstallerPath := ExpandConstant('{uninstallexe}');
  Code := Trim(PairPage.Values[0]);
  Configured := False;

  { 1. pairing }
  if Code <> '' then
  begin
    while True do
    begin
      SetStatus('ক্লাউডের সাথে জোড়া দেওয়া হচ্ছে... (Pairing with the cloud...)');
      if IsValidPairingCode(Code) then
        RC := RunPairing(App, Code, Output)
      else
      begin
        RC := 2;
        Output := 'Invalid pairing code (must start with ADC1.)';
      end;
      if RC = 0 then
      begin
        Configured := True;
        Break;
      end;
      if not AskPairingCodeAgain('exit code ' + IntToStr(RC) + #13#10 + Output, Code) then Break;
    end;

    if not Configured then
    begin
      if HadConfig and FileExists(App + '\config.json') then
      begin
        if SuppressibleMsgBox('নতুন কোড দিয়ে জোড়া দেওয়া যায়নি। আগের সেটআপ দিয়েই কানেক্টর চালু রাখবেন?' + #13#10 +
             '(Pairing with the new code failed. Keep running with the previous setup?)',
             mbConfirmation, MB_YESNO, IDYES) = IDYES then
          Configured := True;
      end;
      if not Configured then
      begin
        if not HadConfig then
        begin
          RollbackFresh := True;
          SetupFailedText := 'ইনস্টল বাতিল হয়েছে: পেয়ারিং ব্যর্থ, তাই ইনস্টল করা ফাইলগুলো সরিয়ে ফেলা হচ্ছে। ' +
            'অ্যাডমিন প্যানেল থেকে নতুন কোড নিয়ে আবার ইনস্টল করুন।' + #13#10#13#10 +
            '(Installation rolled back: pairing failed. Get a new code from the admin panel and run setup again.)';
        end
        else
          SetupFailedText := 'পেয়ারিং ব্যর্থ, কানেক্টর চালু করা হয়নি। নতুন কোড নিয়ে ইনস্টলার আবার চালান।' + #13#10#13#10 +
            '(Pairing failed, the connector was NOT started. Run setup again with a new code.)';
        SuppressibleMsgBox(SetupFailedText, mbError, MB_OK, IDOK);
        Exit;
      end;
    end;
  end
  else
    Configured := FileExists(App + '\config.json');

  if not Configured then
  begin
    SetupFailedText := 'config.json পাওয়া যায়নি, কানেক্টর চালু করা হয়নি। পেয়ারিং কোড দিয়ে ইনস্টলার আবার চালান।' + #13#10#13#10 +
      '(config.json not found - the connector was NOT started. Run setup again with a pairing code.)';
    SuppressibleMsgBox(SetupFailedText, mbError, MB_OK, IDOK);
    Exit;
  end;

  { 2. optional device test (never fatal; runs before the service so the K40 TCP session is free) }
  if TestCheck.Checked and not WizardSilent then
  begin
    SetStatus('K40 ডিভাইস পরীক্ষা করা হচ্ছে... (Testing the K40 device...)');
    RC := RunCaptured(App + '\{#AppExe}', 'test-device', App, ExpandConstant('{tmp}\test-device.txt'), Output);
    AppendInstallerLog('connector test-device -> exit ' + IntToStr(RC), Output);
    if RC = 0 then
      MsgBox('K40 ডিভাইসের সাথে সংযোগ সফল। (K40 connection OK)' + #13#10#13#10 + Output, mbInformation, MB_OK)
    else
      MsgBox('K40 ডিভাইসের সাথে সংযোগ হয়নি (ইনস্টল চলবে; ডিভাইস চালু হলে কানেক্টর নিজেই আবার চেষ্টা করবে)। ' +
        'ডিভাইসের IP / নেটওয়ার্ক কেবল দেখুন।' + #13#10 +
        '(K40 connection test failed - not fatal, the connector keeps retrying. Check device IP / network.)' + #13#10#13#10 +
        'exit code ' + IntToStr(RC) + #13#10 + Output, mbError, MB_OK);
  end;

  { 3. scheduled task (SYSTEM, at startup, auto-restart) }
  SetStatus('Windows টাস্ক ইনস্টল করা হচ্ছে... (Installing the startup task...)');
  RC := RunCaptured(PowerShellExe, '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + App + '\install-service.ps1" -Quiet',
    App, ExpandConstant('{tmp}\install-service.txt'), Output);
  AppendInstallerLog('install-service.ps1 -> exit ' + IntToStr(RC), Output);
  if RC <> 0 then
  begin
    SetupFailedText := 'কানেক্টর কনফিগার হয়েছে, কিন্তু Windows টাস্ক ইনস্টল হয়নি। Administrator PowerShell-এ চালান:' + #13#10 +
      'powershell -ExecutionPolicy Bypass -File "' + App + '\install-service.ps1"' + #13#10#13#10 +
      '(Connector configured, but the startup task could not be installed. Run the command above.)' + #13#10#13#10 + Output;
    SuppressibleMsgBox(SetupFailedText, mbError, MB_OK, IDOK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then DoPostInstall;
end;

{ Rollback of a fresh install whose pairing failed: start the uninstaller once the wizard is gone.
  It removes the program files (data\ and logs\ are kept by design, logs\installer.log helps support). }
procedure DeinitializeSetup;
var
  RC: Integer;
begin
  if RollbackFresh and (UninstallerPath <> '') and FileExists(UninstallerPath) then
    Exec(UninstallerPath, '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE, ewNoWait, RC);
end;
