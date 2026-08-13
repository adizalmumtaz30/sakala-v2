# SAKALA V2 ENTERPRISE
## MASTER SPECIFICATION — BUILD ORDER
### v2.3 HARDENED • IMPLEMENTATION AUTHORITY • FULL BUILD CONTRACT

**Revision:** 12 August 2026 (+ Implementation Baseline Addendum) 
**Status:** Authoritative implementation specification 
**Purpose:** Menjadi satu dokumen kerja yang cukup rinci untuk membangun SAKALA V2 dari proyek kosong sampai production release, termasuk UI/UX, design system, data, workflow, state, jadwal, validasi, testing, dan release.

**Struktur dokumen:**
- **Part I — Bagian 0–65:** spesifikasi teknis & UX detail (baseline asli v2.3 HARDENED).
- **Part II — Bagian 66–129:** *Master Implementation Baseline (Final Recap)* — status proyek, aturan absolut terkonsolidasi, project root, engineering safety net (Pack/Diagnostic Toolchain, Error Handoff, Rollback), Phase Control, dan Phase 00 scope. Lihat Bagian 129 untuk hubungan Part I ↔ Part II.

---

# 0. DOCUMENT CONTROL

## 0.1 Scope

Dokumen ini adalah pengembangan dari **SAKALA V2 Master Specification — BUILD ORDER v2.2** yang telah diberikan. Struktur produk, karakter visual, shell, contextual action, Academic Context, Jadwal Cerdas, Jadwal operasional, responsive behavior, accessibility, visual QA, dan release gate dipertahankan.

v2.3 menambahkan detail implementasi agar developer tidak perlu menebak:

- apa yang harus dibangun;
- urutan pembangunan;
- data apa yang menjadi sumber kebenaran;
- bagaimana setiap layar bereaksi terhadap loading, empty, error, conflict, dan success;
- kapan sebuah perubahan boleh disimpan;
- bagaimana jadwal dibuat dan dipublikasikan;
- bagaimana state disimpan;
- bagaimana UI dipetakan ke route;
- bagaimana komponen harus berperilaku;
- bagaimana aplikasi diuji sebelum release.

## 0.2 Scope of teacher information

Informasi guru yang digunakan untuk operasional jadwal difokuskan pada:

- identitas guru;
- status aktif;
- mata pelajaran yang diampu;
- kelas/rombel yang terkait;
- jumlah jadwal;
- total jam mengajar;
- beban jadwal;
- konflik jadwal.

## 0.3 Authority rule

Jika terdapat konflik antara implementasi dan dokumen ini:

> **Implementasi harus mengikuti dokumen ini.**

Jika ditemukan kebutuhan baru yang belum tercakup:

1. jangan menambahkan pola UI secara spontan;
2. tentukan dahulu domain/state/route yang terdampak;
3. tambahkan kontrak;
4. evaluasi dampak data;
5. evaluasi dampak responsive;
6. evaluasi accessibility;
7. baru implementasikan.

## 0.4 Design = Implementation

Mockup, prototype, screenshot, component contract, dan specification bukan inspirasi.

Semuanya adalah **implementation contract**.

Perbedaan visual yang tidak memiliki alasan fungsional dianggap defect.

---

# 1. PRODUCT NORTH STAR

## 1.1 Product character

SAKALA harus terasa:

- Premium
- Modern
- Calm
- Fast
- Intelligent
- Precise
- Spatially coherent
- Operationally clear
- Desktop-native
- Quiet rather than decorative

SAKALA tidak boleh berubah menjadi:

- wall of cards;
- wall of charts;
- template dashboard generik;
- chatbot yang menyamar sebagai aplikasi;
- mobile UI yang dipaksa membesar ke desktop;
- UI futuristik yang terlalu dekoratif;
- layar yang menampilkan semua action sekaligus.

## 1.2 Experience pipeline

```text
DATA
 ↓
HIERARCHY
 ↓
SPATIAL CONTEXT
 ↓
VISUAL SIGNAL
 ↓
INTERACTION
 ↓
INSIGHT
 ↓
ACTION
```

## 1.3 Product principle

SAKALA bukan sekadar CRUD.

Setiap workspace harus menjawab:

1. Saya sedang berada di mana?
2. Data apa yang sedang saya lihat?
3. Dalam konteks akademik apa?
4. Apa status datanya?
5. Apa yang bermasalah?
6. Apa tindakan berikutnya?
7. Apa dampak tindakan tersebut?

---

# 2. MASTER BUILD PIPELINE

```text
01 Governance & Source of Truth
 ↓
02 Product / IA Contract
 ↓
03 Technical Foundation
 ↓
04 Design Tokens
 ↓
05 Application Shell
 ↓
06 Foundation Components
 ↓
07 Surface / Data / Form Systems
 ↓
08 State / Feedback / Recovery System
 ↓
09 Academic Context + Admin Profile
 ↓
10 Core Data
 ↓
11 Academic Core
 ↓
12 Schedule Model + Slot Template
 ↓
13 Schedule Domain & Validation Engine
 ↓
14 Jadwal Cerdas
 ↓
15 Jadwal Operational Workspace
 ↓
16 Dashboard
 ↓
17 Analytics
 ↓
18 History
 ↓
19 Notifications
 ↓
20 AI Assistant
 ↓
21 Import / Export / Template
 ↓
22 Authentication / Authorization / Sync
 ↓
23 Responsive
 ↓
24 Accessibility
 ↓
25 Performance
 ↓
26 Security
 ↓
27 Automated Testing
 ↓
28 Visual Regression
 ↓
29 Browser Precision QA
 ↓
30 Build Gate
 ↓
31 Release Candidate
 ↓
32 Production Hardening
 ↓
33 Production Release
```

**Hard rule:** Dashboard tidak dibangun sebagai langkah pertama. Dashboard dibangun setelah data, state, query, dan komponen yang diperlukan sudah stabil.

---

# 3. SYSTEM ARCHITECTURE CONTRACT

## 3.1 Recommended layers

```text
Presentation
 ↓
Application
 ↓
Domain
 ↓
Data Access
 ↓
Database / External Service
```

### Presentation

Tanggung jawab:

- route;
- layout;
- component;
- visual state;
- interaction;
- accessibility.

Presentation tidak boleh menyimpan aturan bisnis inti.

### Application

Tanggung jawab:

- use case;
- orchestration;
- command;
- query;
- workflow;
- permission check;
- transaction boundary.

### Domain

Tanggung jawab:

- entity;
- value object;
- schedule rule;
- conflict rule;
- state transition;
- invariants.

### Data Access

Tanggung jawab:

- repository;
- query;
- persistence;
- transaction;
- cache;
- synchronization.

## 3.2 Single responsibility

Tidak boleh:

```text
React Component
 ├─ query database
 ├─ calculate conflict
 ├─ mutate state
 ├─ format business rule
 └─ render UI
```

Gunakan:

```text
UI
 ↓
Use Case
 ↓
Domain Service
 ↓
Repository
 ↓
Database
```

---

# 4. PROJECT FOUNDATION

## 4.1 Repository structure

Recommended:

```text
sakala/
├─ apps/
│ ├─ desktop/
│ └─ web/
├─ packages/
│ ├─ ui/
│ ├─ design-tokens/
│ ├─ domain/
│ ├─ application/
│ ├─ data-access/
│ ├─ validation/
│ └─ config/
├─ database/
├─ migrations/
├─ docs/
│ ├─ specification/
│ ├─ architecture/
│ ├─ workflows/
│ └─ qa/
├─ assets/
│ ├─ branding/
│ ├─ splash/
│ └─ icons/
├─ tests/
│ ├─ unit/
│ ├─ component/
│ ├─ integration/
│ ├─ e2e/
│ └─ visual/
└─ scripts/
```

## 4.2 Environment separation

Minimum:

```text
development
test
staging
production
```

Tidak boleh menggunakan database production untuk test.

## 4.3 Configuration

Semua configuration yang berbeda antar environment harus berada di configuration layer.

Jangan hardcode:

- API URL;
- database URL;
- timeout;
- feature flag;
- upload limit;
- environment name.

---

# 5. SOURCE OF TRUTH ASSETS

## 5.1 Master Logo

Master Logo PNG transparent adalah sumber tunggal identitas visual.

Rules:

- tidak digambar ulang;
- tidak diganti icon;
- tidak direcolor;
- tidak didistorsi;
- tidak dicrop;
- aspect ratio dipertahankan;
- transparency dipertahankan;
- `object-fit: contain`.

Penggunaan:

- splash;
- application header;
- sidebar;
- login jika ada;
- application icon;
- favicon jika web;
- loading state;
- documentation.

## 5.2 Splash

Splash harus menggunakan identitas yang sama:

- logo;
- wordmark;
- Enterprise Scheduling Intelligence;
- gold/cyan glow;
- circuit wires;
- circuit nodes;
- progress;
- reduced-motion mode.

---

# 6. INFORMATION ARCHITECTURE

## 6.1 Top-level Core

```text
Dashboard
Data
Akademik
Jadwal Cerdas
Jadwal
Analitik
Riwayat
Notifikasi
AI
Navigasi
```

Import, Export, Template, Download, dan Rekap adalah **contextual capability**.

## 6.2 Core responsibility

| Core | Responsibility |
|---|---|
| Dashboard | Ringkasan kondisi |
| Data | Master data |
| Akademik | Struktur dan periode |
| Jadwal Cerdas | Generate, constraint, conflict, candidate |
| Jadwal | Jadwal operasional |
| Analitik | Insight dan analisis |
| Riwayat | Activity, changes, versions |
| Notifikasi | Persistent notifications |
| AI | Assistance |
| Navigasi | Navigation/search preferences |

## 6.3 Route contract

Setiap route memiliki:

```text
routeKey
title
requiredPermission
requiredAcademicContext
defaultView
queryState
restorationPolicy
```

Contoh:

```text
/jadwal
/jadwal/kelas/:classId
/jadwal/guru/:teacherId
/jadwal/ruangan/:roomId
/jadwal-cerdas
/guru
/guru/:teacherId
/mata-pelajaran
/kelas
/ruangan
/akademik
/profil-admin
```

---

# 7. STATE ARCHITECTURE

## 7.1 Three state layers

### Global State

Contoh:

- authenticated user;
- active academic context;
- theme;
- connection status.

### Workspace State

Contoh:

- selected class;
- selected teacher;
- date;
- filter;
- sort;
- density;
- schedule view.

### Temporary UI State

Contoh:

- open popover;
- dialog;
- toast;
- tooltip;
- context menu;
- drag state.

## 7.2 Persistence rule

Global state boleh persistent.

Workspace state persistent hanya jika membantu continuation.

Temporary state tidak boleh persistent lintas session.

---

# 8. ACADEMIC CONTEXT

## 8.1 School Profile

Fields:

| Field | Required |
|---|---|
| Nama | Yes |
| Jabatan | Yes |
| Nama Sekolah | Yes |
| Tahun Pelajaran | Yes |
| Semester | Yes |

Tahun Pelajaran dan Semester pada profile adalah **default context**.

## 8.2 Active Academic Context

Active context adalah context yang sedang digunakan.

Semua query/mutation yang terkait akademik harus menggunakan context identifier.

Jangan mengambil context berdasarkan text label.

## 8.3 Context switch

Saat user mengganti context:

```text
Current Context
 ↓
Check unsaved changes
 ↓
Check pending operation
 ↓
Confirm if necessary
 ↓
Load new context
 ↓
Clear invalid workspace state
 ↓
Refresh dependent data
```

## 8.4 Context switch safety

Context switch harus:

- membatalkan query lama;
- mencegah response lama menimpa context baru;
- reset filter yang tidak valid;
- mempertahankan filter yang masih valid;
- menampilkan loading lokal;
- menampilkan error lokal jika gagal.

---

# 9. DESIGN SYSTEM

## 9.1 Token groups

```text
Color
Typography
Spacing
Radius
Border
Shadow
Elevation
Motion
Breakpoint
Density
Icon
Z-index
Focus
Opacity
```

## 9.2 Color semantic

Jangan memakai warna hanya berdasarkan nama visual.

Gunakan semantic token:

```text
background
surface
surfaceElevated
textPrimary
textSecondary
textMuted
border
accent
success
warning
danger
info
focus
```

## 9.3 Typography

Desktop baseline:

- Page title: 28–32 px
- Section title: 18–22 px
- Body: 14–16 px
- Meta: 12–14 px

Form:

- 44 px default;
- 36 px compact;
- 48 px large.

## 9.4 Density

Official:

```text
Comfortable
Compact
```

Compact digunakan untuk:

- schedule;
- table;
- dense admin workspace.

---

# 10. APPLICATION SHELL

## 10.1 Shell

```text
┌────────────────────────────────────────────────────────────┐
│ Header / Context Bar │
├───────────────┬────────────────────────────────────────────┤
│ Sidebar │ Workspace │
│ │ │
│ Navigation │ │
└───────────────┴────────────────────────────────────────────┘
```

## 10.2 Header

```text
LEFT
Brand + navigation

CENTER
Global Search / Command Palette

RIGHT
Connection + notification + profile
```

## 10.3 Sidebar

Expanded:

```text
220–248 px
```

Collapsed:

```text
64–72 px
```

Rules:

- active item clear;
- icon + label;
- section hierarchy;
- tooltip on collapsed state;
- keyboard reachable.

## 10.4 Workspace header

Every workspace should expose:

```text
Breadcrumb / Core
Page title
Context
Optional description
Primary action
Secondary actions
```

## 10.5 Command Palette

Minimum:

- open by keyboard;
- search route;
- search entity;
- action;
- recent action;
- navigation.

Recommended shortcut:

```text
Cmd/Ctrl + K
```

---

# 11. FOUNDATION COMPONENT CONTRACT

Required primitives:

- Button
- Input
- Select
- Search
- Checkbox
- Radio
- Switch
- Badge
- Tooltip
- Popover
- Context Menu
- Dialog
- Sheet
- Toast
- Skeleton
- Spinner
- Progress
- Tabs
- Segmented Control
- Date Picker
- Calendar
- Data Table
- Pagination
- Empty State
- Error State

Every component defines:

```text
Anatomy
Props
Variants
Sizes
States
Keyboard
Focus
Loading
Disabled
Error
Responsive
Accessibility
Motion
```

---

# 12. INTERACTION SURFACE HIERARCHY

Use the smallest surface that can solve the task.

```text
Tooltip
 ↓
Popover
 ↓
Dropdown / Context Menu
 ↓
Sheet
 ↓
Dialog
 ↓
Full workspace
```

Do not use a dialog for:

- simple information;
- one-click contextual action;
- filter;
- small edit;
- tooltip content.

## 12.1 Dialog rule

A dialog is required when:

- destructive action;
- important confirmation;
- focused multi-field task;
- irreversible operation;
- candidate commit.

---

# 13. DATA TABLE CONTRACT

Every table supports, where applicable:

- search;
- filter;
- sort;
- pagination;
- column visibility;
- row selection;
- bulk action;
- loading;
- empty;
- error;
- row action;
- detail view.

## 13.1 Row state

```text
default
hover
selected
disabled
warning
error
```

## 13.2 Large dataset

For large data:

- pagination or virtualization;
- stable row keys;
- server-side filtering when necessary;
- no re-render of entire table for one-row change.

---

# 14. FORM SYSTEM

## 14.1 Form hierarchy

```text
Field
 ↓
Form
 ↓
Entity
 ↓
Cross-entity
 ↓
Domain validation
```

## 14.2 Validation timing

Use:

- immediate validation for obvious local format;
- on blur for required/format;
- on submit for cross-field;
- before commit for domain constraints.

## 14.3 Error message

Bad:

> Invalid data.

Good:

> Mata pelajaran belum dipilih.

Error must explain:

1. what is wrong;
2. where;
3. how to fix it.

---

# 15. LOADING / EMPTY / ERROR / SUCCESS

## 15.1 Loading

Priority:

```text
Skeleton
↓
Inline
↓
Button
↓
Progress
↓
Full workspace only if unavoidable
```

## 15.2 Empty

```text
Context
↓
Explanation
↓
Action
```

## 15.3 Error

```text
What happened
↓
Impact
↓
Recovery
```

## 15.4 Success

Use local feedback:

- toast;
- inline success;
- updated row;
- updated KPI.

Do not navigate away merely to show success.

## 15.5 No infinite loading

Every async operation has:

```text
idle
loading
success
error
retry
```

Long task may additionally have:

```text
queued
running
completed
cancelled
```

---

# 16. ADMIN SCHOOL PROFILE

## 16.1 Entry

Top-right account menu:

```text
Avatar
Nama
Jabatan
Nama Sekolah

Profil Admin Sekolah
```

## 16.2 Screen layout

```text
Page Header
 ↓
Profile Card
 ↓
Identity
 ↓
School Context Defaults
 ↓
Save
```

## 16.3 Save behavior

On save:

```text
Validate
 ↓
Persist
 ↓
Update profile cache
 ↓
Show success
```

Changing default academic context must not silently replace active context.

---

# 17. CORE DATA MODEL

Build in order:

```text
Guru
↓
Mata Pelajaran
↓
Kelas
↓
Ruangan
```

## 17.1 Guru

Required:

- ID Guru;
- Nama Guru;
- Status Aktif/Nonaktif.

Relations:

- subjects;
- classes/rombel;
- schedules.

Computed:

- jumlah jadwal;
- total jam mengajar;
- beban jadwal;
- konflik.

## 17.2 Mata Pelajaran

Minimum:

- ID;
- Nama;
- Kode;
- Status;
- Target JP per rombel where applicable.

## 17.3 Kelas

Minimum:

- ID;
- tingkat;
- nama rombel;
- status;
- academic context.

## 17.4 Ruangan

Minimum:

- ID;
- nama;
- kapasitas if needed;
- status;
- room type;
- availability.

---

# 18. DOMAIN RELATION CONTRACT

Core relations:

```text
Academic Context
 ├─ Guru
 ├─ Mata Pelajaran
 ├─ Kelas
 ├─ Rombel
 ├─ Ruangan
 ├─ Schedule Model
 └─ Jadwal
```

A record that depends on an academic context must not be accidentally reused across contexts without an explicit relation.

---

# 19. AKADEMIK CORE

Implement:

- Tahun Ajaran;
- Semester;
- Struktur Akademik;
- Pembagian Tugas.

Temporal hierarchy:

```text
Tahun Ajaran
 ↓
Semester
 ↓
Periode Akademik
 ↓
Minggu
 ↓
Hari
 ↓
Jam Pelajaran
 ↓
Slot Jadwal
```

## 19.1 Time model

Every period has:

```text
periodNumber
startTime
endTime
durationMinutes
day
status
```

Break is not a teaching period.

School days are configurable.

---

# 20. SCHEDULE MODEL

Schedule Model is configuration, not a timetable itself.

Required:

- model name;
- start time;
- standard duration;
- maximum periods/day;
- active days;
- holidays;
- academic context;
- rombel usage;
- status.

## 20.1 Room mode

Explicit:

```text
Required
Optional
Not Used
```

The engine must never infer this.

## 20.2 Slot types

```text
Belajar Mengajar
Upacara
Religi
Istirahat
Libur
Custom
```

Fixed slots block ordinary teaching assignments.

---

# 21. SCHEDULE DOMAIN MODEL

A schedule assignment contains at minimum:

```text
scheduleId
academicContextId
classId
subjectId
teacherId
roomId?
day
periodStart
periodEnd
activityType
status
source
versionId
createdAt
updatedAt
```

## 21.1 Source

```text
manual
generated
imported
ai_assisted
```

## 21.2 Status

```text
draft
candidate
committed
archived
cancelled
```

## 21.3 Version

Committed schedule must belong to a schedule version.

Version contains:

```text
versionId
academicContextId
label
createdBy
createdAt
source
status
changeSummary
```

---

# 22. SCHEDULE INVARIANTS

These are non-negotiable domain rules.

## 22.1 Teacher conflict

One teacher cannot teach two classes in the same time slot.

## 22.2 Class conflict

One class cannot have two subjects in the same time slot.

## 22.3 Room conflict

If room mode applies, one room cannot be assigned to two classes in the same time slot.

## 22.4 Fixed activity

Teaching cannot occupy a fixed activity slot.

## 22.5 JP reconciliation

Configured subject target and committed schedule must reconcile.

State:

```text
Complete
Incomplete
Over
```

## 22.6 Active entity

Inactive teacher, subject, class, or room cannot be assigned to a new committed schedule.

Existing historical records remain readable.

---

# 23. CONFLICT ENGINE

Conflict result must be structured.

```text
conflictId
severity
type
entityType
entityIds
scheduleIds
message
resolutionHint
blocking
```

## 23.1 Severity

```text
Error = blocks commit
Warning = does not necessarily block
Info = informational
```

## 23.2 Conflict types

At minimum:

```text
TEACHER_OVERLAP
CLASS_OVERLAP
ROOM_OVERLAP
FIXED_SLOT
INVALID_PERIOD
INACTIVE_ENTITY
JP_MISMATCH
MISSING_REQUIRED_FIELD
CONTEXT_MISMATCH
```

## 23.3 UI behavior

Conflict should be visible at:

- slot;
- row;
- summary;
- validation panel.

Clicking a conflict must navigate to the affected entity or slot.

---

# 24. JADWAL CERDAS

## 24.1 Responsibility

Jadwal Cerdas is responsible for:

- collecting constraints;
- generating candidate schedules;
- detecting conflicts;
- evaluating quality;
- optional optimization;
- preview;
- final validation;
- commit.

## 24.2 Pipeline

```text
Load Context
 ↓
Select Scope
 ↓
Load Constraints
 ↓
Normalize
 ↓
Generate Candidate
 ↓
Validate
 ↓
Conflict Detection
 ↓
Candidate Review
 ↓
Optional Optimization
 ↓
Final Validation
 ↓
Commit
 ↓
Create Version
 ↓
Audit
```

## 24.3 Candidate isolation

Candidate data must be isolated from committed data.

Never:

```text
Generate → overwrite active schedule
```

Always:

```text
Generate → candidate workspace
```

## 24.4 Optimization

Optimization requires explicit user action.

Before optimization show:

- current candidate;
- expected changes;
- affected classes;
- affected teachers;
- affected rooms;
- known conflicts;
- estimated operation time if meaningful.

After optimization show:

```text
Before
After
Changes
Remaining conflicts
```

User must explicitly choose:

```text
Keep Current
Apply Optimization
```

---

# 25. JADWAL OPERATIONAL WORKSPACE

Jadwal is the committed/operational timetable.

## 25.1 Views

Minimum:

```text
Per Kelas
Per Guru
Per Ruangan
Harian
Mingguan
```

## 25.2 Weekly desktop grid

Columns:

```text
Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
```

Rows:

```text
Period
Start
End
```

Cell:

```text
Subject
Teacher
Room
Activity
Status
```

## 25.3 Cell states

```text
Empty
Occupied
Fixed Activity
Conflict
Incomplete
Complete
Loading
Error
```

## 25.4 Empty cell

Show:

```text
+ Tambah Jadwal
```

Only when user has permission and the slot is eligible.

## 25.5 Occupied cell

Click opens schedule detail.

Context menu may offer:

```text
View
Edit
Move
Duplicate
Delete
```

Available actions depend on status and permission.

---

# 26. ADD SCHEDULE WORKFLOW

```text
1. Select class/rombel
 ↓
2. Select subject
 ↓
3. Select teacher
 ↓
4. Select eligible slot
 ↓
5. Select room if required
 ↓
6. Review assignment
 ↓
7. Validate
 ↓
8. Save Draft / Commit
```

## 26.1 Eligible slot filtering

The UI should hide or disable impossible slots based on:

- class occupancy;
- teacher occupancy;
- room occupancy;
- fixed activity;
- active days;
- entity status;
- schedule model.

## 26.2 Before commit

Show compact review:

```text
Kelas
Mapel
Guru
Hari
Jam
Ruangan
Durasi
```

Then:

```text
Validasi berhasil
[ Simpan ]
```

or:

```text
Ditemukan konflik
[ Lihat Konflik ]
[ Kembali Edit ]
```

---

# 27. MOVE / EDIT SCHEDULE

Moving an assignment is not the same as editing its label.

Workflow:

```text
Select schedule
 ↓
Choose new slot
 ↓
Preview impact
 ↓
Validate
 ↓
Confirm
 ↓
Commit
 ↓
Create history
```

If moving creates conflict:

> Do not allow commit while blocking conflict remains.

---

# 28. DELETE SCHEDULE

Delete is destructive.

Required:

```text
Dialog
Affected data
Reason optional/required by policy
Confirm
```

After delete:

- update timetable;
- update conflict state;
- update counters;
- update analytics;
- create history.

---

# 29. REGULATION / TARGET JP VIEW

Keep this focused on scheduling completeness, without qualification classification.

Show:

- target JP;
- scheduled JP;
- difference;
- completion percentage;
- per-subject target;
- per-subject actual;
- state;
- action to affected schedule.

States:

```text
Belum Mulai
Belum Lengkap
Lengkap
Melebihi Target
```

Clicking the state must expose the exact affected subject/schedule.

---

# 30. TEACHER SCHEDULE VIEW

Teacher workspace focuses only on operational scheduling.

Show:

- Nama Guru;
- Status;
- Mata Pelajaran;
- Kelas/Rombel;
- Jumlah Jadwal;
- Total Jam Mengajar;
- Distribusi hari;
- Konflik;
- Jadwal aktif.

Do not include qualification-classification fields.

---

# 31. DASHBOARD

Dashboard is a summary, not the place where all editing occurs.

## 31.1 Hierarchy

```text
Academic Context
 ↓
Greeting / Workspace
 ↓
Key Metrics
 ↓
Primary Schedule Insight
 ↓
Workload / Distribution
 ↓
Heatmap
 ↓
Upcoming Agenda
 ↓
Recent Activity
```

## 31.2 KPI contract

KPI must include:

```text
label
value
unit
trend if meaningful
comparison period if meaningful
status
click action
```

Avoid decorative metrics with no action.

## 31.3 Dashboard states

Dashboard must support:

- first use;
- empty school data;
- incomplete setup;
- normal;
- conflict;
- loading;
- offline;
- error.

---

# 32. ANALYTICS

Analytics should answer:

```text
What happened?
Why?
What should I do?
```

Allowed:

- line;
- bar;
- donut;
- area;
- heatmap.

No chart may communicate meaning through color alone.

Every interactive chart should support, where useful:

- hover;
- selection;
- filtering;
- drill-down.

---

# 33. SCHEDULE HEATMAP

Heatmap purpose:

> Show schedule density and potential concentration.

Dimensions:

```text
Day × Period
```

Cell intensity represents density.

Hover/click must show:

```text
Day
Time
Class count
Teacher count
Room count
Density
```

Heatmap must not be the sole source of conflict information.

---

# 34. HISTORY / AUDIT

Every important mutation records:

```text
Who
What
When
Context
Entity
Before
After
Source
Reason if available
```

Schedule events:

- create;
- edit;
- move;
- delete;
- generate;
- optimize;
- validate;
- commit;
- import;
- restore.

---

# 35. NOTIFICATION SYSTEM

Categories:

```text
System
Schedule
Validation
Import
Sync
```

Priority:

```text
Info
Success
Warning
Critical
```

Toast:

> immediate local feedback.

Notification Center:

> persistent information.

Do not duplicate the same event excessively.

---

# 36. AI ASSISTANT

AI is an assistant, not an autonomous mutation engine.

Allowed:

- explain;
- summarize;
- recommend;
- detect patterns;
- assist with schedule planning.

Critical mutation flow:

```text
AI Suggestion
 ↓
Preview
 ↓
Validation
 ↓
User Confirmation
 ↓
Commit
```

Never:

```text
AI → silent database mutation
```

---

# 37. IMPORT

Import remains contextual.

Pipeline:

```text
Select Core
 ↓
Download Template
 ↓
Upload
 ↓
Parse
 ↓
Map Columns
 ↓
Preview
 ↓
Validate
 ↓
Show Errors
 ↓
Confirm
 ↓
Commit
 ↓
Summary
```

## 37.1 Error mapping

Each failed row shows:

- row;
- field;
- current value;
- expected value;
- error;
- suggested correction.

## 37.2 Import transaction

If policy requires atomic import:

```text
all valid → commit
any blocking error → rollback
```

If partial import is allowed, the UI must explicitly show:

```text
Imported
Skipped
Failed
```

---

# 38. EXPORT

Pipeline:

```text
Filter
 ↓
Select columns
 ↓
Choose format
 ↓
Generate
 ↓
Download
```

Export must use the active academic context.

---

# 39. TEMPLATE VERSIONING

Every template has:

```text
templateName
schemaVersion
createdAt
supportedModule
```

Import rejects incompatible schema versions unless a migration exists.

---

# 40. AUTHENTICATION / AUTHORIZATION

Minimum:

- login;
- session;
- logout;
- permission;
- authorization;
- session expiry;
- retry;
- connection state.

## 40.1 Permission model

Actions require permission, not merely route access.

Examples:

```text
view
create
edit
delete
import
export
generate
optimize
commit
```

---

# 41. ONLINE / OFFLINE / SYNC

Connection states:

```text
Online
Connecting
Offline
Syncing
Sync Error
```

UI should show status quietly.

If offline support exists, clearly define which operations are:

```text
available offline
queued
blocked
```

Never imply successful sync when data is only locally queued.

---

# 42. SPLASHSCREEN STATE MACHINE

```text
BOOT
 ↓
ASSET READY
 ↓
SESSION CHECK
 ↓
PROFILE READY
 ↓
ACADEMIC CONTEXT READY
 ↓
CORE DATA READY
 ↓
SHELL READY
 ↓
READY
```

Failure:

```text
Failure
 ↓
Explain
 ↓
Retry
 ↓
Safe exit
```

No infinite spinner.

Progress must reflect real startup phases where possible.

Reduced motion:

- no glow animation;
- no wire animation;
- no node animation;
- no logo animation;
- no wordmark animation;
- no exit animation.

---

# 43. RESPONSIVE SYSTEM

Priority:

1. Desktop / Chrome 100%
2. Laptop
3. Tablet
4. Mobile

Breakpoints:

| Width | Mode |
|---|---|
| ≥ 1440 | Desktop Large |
| 1200–1439 | Desktop |
| 1024–1199 | Compact Desktop |
| 768–1023 | Tablet |
| < 768 | Mobile |

Responsive means transformation, not shrinking.

## 43.1 Schedule

Desktop:

> weekly grid.

Tablet:

> day-focused or controlled horizontal view.

Mobile:

> agenda/day list.

---

# 44. ACCESSIBILITY

Minimum:

- keyboard navigation;
- visible focus;
- semantic structure;
- ARIA where needed;
- field/error association;
- contrast;
- screen-reader labels;
- touch targets;
- no color-only meaning;
- reduced motion.

Focus order must follow visual reading order.

Escape closes the nearest temporary surface.

---

# 45. PERFORMANCE

Audit:

- bundle;
- rendering;
- charts;
- tables;
- API;
- database;
- cache;
- lazy loading;
- virtualization.

## 45.1 Schedule performance

Large schedule grids must not rerender the entire grid after a single cell change.

Use:

- stable keys;
- memoized cells;
- selective state updates;
- virtualization when necessary.

---

# 46. SECURITY

Minimum:

- authentication;
- authorization;
- input validation;
- API validation;
- session security;
- sanitized errors;
- data access control;
- audit of critical mutations.

Never expose:

- database credentials;
- stack traces;
- internal paths;
- secret keys;
- internal service details.

---

# 47. TESTING CONTRACT

Testing order:

```text
Unit
 ↓
Component
 ↓
Integration
 ↓
Workflow
 ↓
E2E
 ↓
Visual
```

Critical workflows:

- add/edit/delete Guru;
- add/edit/delete Mata Pelajaran;
- add/edit/delete Kelas;
- add/edit/delete Ruangan;
- edit Admin Profile;
- change Academic Context;
- add schedule;
- edit schedule;
- move schedule;
- delete schedule;
- generate candidate;
- validate candidate;
- detect conflict;
- optimize candidate;
- review candidate;
- commit schedule;
- import;
- export;
- dashboard;
- analytics;
- notification;
- authentication;
- offline/reconnect.

---

# 48. TEST MATRIX FOR SCHEDULE

Every schedule workflow must test:

```text
Normal
Empty
Loading
Error
Conflict
Warning
Permission denied
Unsaved changes
Context change
Offline
Reconnect
Duplicate submission
Rapid click
Back navigation
Refresh
```

---

# 49. RACE CONDITION PROTECTION

Common dangerous scenario:

```text
User changes Context A → B
Request A returns after request B
```

The UI must reject stale response A.

Use:

```text
requestId
contextId
abort/cancel
version check
```

Similar protection applies to:

- search;
- filter;
- schedule generation;
- import;
- save.

---

# 50. DOUBLE SUBMISSION PROTECTION

When a mutation starts:

```text
Idle
 ↓
Submitting
 ↓
Success / Error
```

During submitting:

- disable duplicate action;
- keep button geometry stable;
- show progress;
- prevent duplicate request.

---

# 51. UNSAVED CHANGE PROTECTION

Before leaving an edited form:

```text
No changes → leave
Changes → confirm
Submitting → wait / confirm
```

Browser close, route change, context switch, and entity switch must use the same policy.

---

# 52. OPTIMISTIC UI POLICY

Optimistic update is allowed only for low-risk actions where rollback is deterministic.

Do not use optimistic mutation for:

- schedule commit;
- bulk import;
- destructive delete;
- academic context switch;
- schedule optimization.

Use confirmed server/domain response.

---

# 53. DATA INTEGRITY

Every mutation should define:

```text
precondition
mutation
postcondition
side effects
audit event
```

Example schedule commit:

```text
Precondition:
candidate valid

Mutation:
persist schedule + version

Postcondition:
committed schedule readable

Side effects:
recalculate conflict/metrics
create history
notify if required
```

---

# 54. VERSIONING

Schedule versioning must support:

```text
Create
View
Compare
Activate
Archive
Restore
```

Do not overwrite history.

---

# 55. VISUAL REGRESSION

Compare design against browser screenshot.

Check:

- typography;
- spacing;
- alignment;
- icon size;
- card geometry;
- table;
- schedule grid;
- chart;
- popover;
- dialog;
- responsive transformation;
- hover;
- focus;
- loading;
- error;
- empty;
- animation.

---

# 56. CHROME 100% PRECISION GATE

Primary:

```text
1366×768
1440×900
1536×864
1920×1080
```

Also:

```text
90%
100%
110%
125%
High-DPI
```

No:

- clipping;
- broken grid;
- accidental scrollbar;
- incorrect popup anchor;
- schedule misalignment;
- calendar overflow;
- loading layout shift.

---

# 57. RELEASE GATES

## Gate A — Foundation

- project builds;
- tokens work;
- shell works;
- component library works.

## Gate B — Data

- CRUD works;
- validation works;
- persistence works.

## Gate C — Schedule

- model works;
- slot works;
- conflict works;
- candidate works;
- commit works;
- version works.

## Gate D — Experience

- dashboard;
- analytics;
- history;
- notifications;
- AI.

## Gate E — Quality

- responsive;
- accessibility;
- performance;
- security;
- automated tests;
- visual QA.

## Gate F — Release

- production build;
- migrations;
- backup;
- monitoring;
- rollback plan;
- release notes.

---

# 58. DEFINITION OF DONE

A feature is **not Done** merely because it renders.

A feature is Done only when:

```text
UI
+
Interaction
+
State
+
Data
+
Validation
+
Error
+
Loading
+
Empty
+
Permission
+
Responsive
+
Accessibility
+
Testing
+
Audit
```

have been addressed where applicable.

---

# 59. FEATURE IMPLEMENTATION TEMPLATE

Every future feature must document:

```text
Feature Name
Purpose
Route
Permission
Entry Point
Primary User
Inputs
Outputs
Entities
Queries
Mutations
States
Validation
Error Cases
Loading
Empty
Success
Responsive
Accessibility
Audit
Analytics Impact
Notification Impact
Test Cases
Definition of Done
```

This prevents feature drift.

---

# 60. SCREEN IMPLEMENTATION TEMPLATE

Every screen must document:

```text
Screen
Route
Context
Layout
Header
Primary Action
Secondary Actions
Content
Filters
Table/Grid
Detail
Empty State
Loading State
Error State
Permission State
Keyboard
Responsive
Navigation
Analytics
Audit
```

---

# 61. COMPONENT IMPLEMENTATION TEMPLATE

Every component must document:

```text
Name
Purpose
Anatomy
Props
Variants
Sizes
States
Keyboard
Focus
Disabled
Loading
Error
Responsive
Accessibility
Motion
Usage Rules
Anti-patterns
```

---

# 62. FINAL ACCEPTANCE CHECKLIST

## Product

- [ ] Core structure canonical.
- [ ] Contextual actions remain contextual.
- [ ] Jadwal Cerdas and Jadwal clearly separated.
- [ ] Active Academic Context has one source of truth.
- [ ] Profile stores default context only.
- [ ] Critical mutations have safe lifecycle.

## Data

- [ ] Entity relations correct.
- [ ] Context isolation correct.
- [ ] Inactive entities protected.
- [ ] Transactions defined.
- [ ] Audit events defined.

## Schedule

- [ ] Schedule Model.
- [ ] Slot Template.
- [ ] Room mode.
- [ ] Class timetable.
- [ ] Teacher timetable.
- [ ] Room timetable.
- [ ] Target JP.
- [ ] Conflict engine.
- [ ] Candidate generation.
- [ ] Review.
- [ ] Commit.
- [ ] Version.
- [ ] History.

## UI

- [ ] Shell.
- [ ] Context Bar.
- [ ] Command Palette.
- [ ] Component states.
- [ ] Density.
- [ ] Empty/error/loading.
- [ ] No unnecessary modal.
- [ ] No wall of cards.
- [ ] No wall of charts.

## Startup

- [ ] Master Logo.
- [ ] Splash.
- [ ] Startup state machine.
- [ ] Failure/retry.
- [ ] Reduced motion.
- [ ] No infinite loading.

## Quality

- [ ] Accessibility.
- [ ] Responsive.
- [ ] Performance.
- [ ] Security.
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] E2E.
- [ ] Visual regression.
- [ ] Chrome 100%.
- [ ] Release gate.

---

# 63. FINAL BUILD SEQUENCE

```text
CONSTITUTION
 ↓
IA
 ↓
TECHNICAL FOUNDATION
 ↓
DESIGN TOKENS
 ↓
COMPONENT CONTRACTS
 ↓
APPLICATION SHELL
 ↓
SURFACE SYSTEM
 ↓
DATA SYSTEM
 ↓
FORM SYSTEM
 ↓
STATE / FEEDBACK / RECOVERY
 ↓
ACADEMIC CONTEXT
 ↓
ADMIN PROFILE
 ↓
CORE DATA
 ↓
AKADEMIK
 ↓
SCHEDULE MODEL
 ↓
SCHEDULE DOMAIN
 ↓
CONFLICT ENGINE
 ↓
JADWAL CERDAS
 ↓
JADWAL
 ↓
DASHBOARD
 ↓
ANALITIK
 ↓
RIWAYAT
 ↓
NOTIFIKASI
 ↓
AI
 ↓
IMPORT / EXPORT
 ↓
AUTH / AUTHORIZATION
 ↓
SYNC / OFFLINE
 ↓
RESPONSIVE
 ↓
ACCESSIBILITY
 ↓
PERFORMANCE
 ↓
SECURITY
 ↓
TESTING
 ↓
VISUAL REGRESSION
 ↓
CHROME 100%
 ↓
BUILD GATE
 ↓
RELEASE CANDIDATE
 ↓
PRODUCTION HARDENING
 ↓
PRODUCTION RELEASE
```

---

# 64. DEFINITIVE RULES

> **Design = Implementation.**

> **Active Academic Context adalah satu-satunya context aktif yang boleh menjadi dasar query/mutation workspace.**

> **School Profile menyimpan default context; default bukan active context.**

> **Jadwal Cerdas menghasilkan candidate. Jadwal adalah operational schedule.**

> **Candidate tidak boleh mengubah committed schedule sebelum user melakukan commit.**

> **Conflict yang bersifat blocking tidak boleh di-commit.**

> **Optimization harus eksplisit dan dapat direview.**

> **Tidak boleh ada infinite loading.**

> **Tidak boleh ada silent mutation.**

> **Import dan Export tetap contextual.**

> **Semua critical mutation harus dapat ditelusuri.**

> **Responsive berarti transformasi layout, bukan sekadar mengecilkan ukuran.**

> **Aplikasi harus tetap tenang secara visual meskipun datanya kompleks.**

---

# 65. DOCUMENT STATUS

**SAKALA V2.3 — HARDENED FULL BUILD CONTRACT**

Dokumen ini menjadi baseline implementasi dari proyek kosong sampai production release.

v2.3 memusatkan spesifikasi pada operasional akademik, pengelolaan data, penjadwalan, validasi, pengalaman pengguna, dan kualitas aplikasi.

**Target akhir:**

> Developer dapat membaca dokumen ini dari atas ke bawah dan mengetahui apa yang harus dibangun, urutan pembangunannya, aturan perilakunya, state yang harus ditangani, cara validasinya, dan kondisi yang harus dipenuhi sebelum release.

---

# PART II — IMPLEMENTATION BASELINE ADDENDUM (v2.3 FINAL RECAP)

> Bagian 66–92 di bawah ini adalah **SAKALA V2.3 — MASTER IMPLEMENTATION BASELINE (FINAL RECAP)**, digabungkan penuh ke dalam dokumen ini sebagai baseline resmi tambahan. Jika ada konflik redaksional antara Part I (Bagian 0–65) dan Part II, **Part I tetap authoritative untuk detail teknis**; Part II adalah lapisan **status, urutan eksekusi, dan safety-net engineering** yang mengikat cara dokumen ini dieksekusi.

---

# 66. BASELINE STATUS

```text
Specification: SAKALA V2.3
Product: SAKALA V2 ENTERPRISE
Implementation mode: Incremental / Pack-based
Target: Zero-to-Production
Current phase: PRE-PHASE 00 / READY
```

Belum mulai coding aplikasi pada saat baseline ini dikunci.

Sumber utama tetap:

```text
SAKALA-V2-Master-Specification-BUILD-ORDER-v2.3.md
```

Dokumen tersebut adalah **AUTHORITATIVE IMPLEMENTATION SPECIFICATION / FULL BUILD CONTRACT**. Jika terjadi konflik, dokumen menang.

---

# 67. FILOSOFI UTAMA (RECAP)

SAKALA harus terasa:

```text
Premium
Modern
Calm
Fast
Intelligent
Precise
Spatially coherent
Operationally clear
Desktop-native
Quiet rather than decorative
```

SAKALA bukan:

```text
generic SaaS dashboard
wall of cards
wall of charts
chatbot yang menyamar sebagai aplikasi
mobile UI yang diperbesar
UI futuristik berlebihan
layar penuh dengan semua action sekaligus
```

Pipeline UX:

```text
DATA
 ↓
HIERARCHY
 ↓
SPATIAL CONTEXT
 ↓
VISUAL SIGNAL
 ↓
INTERACTION
 ↓
INSIGHT
 ↓
ACTION
```

Setiap workspace harus menjawab:

```text
1. Saya berada di mana?
2. Data apa yang sedang dilihat?
3. Context akademiknya apa?
4. Status data bagaimana?
5. Apa yang salah?
6. Apa tindakan berikutnya?
7. Apa dampak tindakan tersebut?
```

---

# 68. ATURAN ABSOLUT (RECAP — MENGIKAT PENUH)

Ini adalah aturan yang tidak boleh dilanggar, dalam bentuk konsolidasi:

> **DESIGN = IMPLEMENTATION**

> **ACTIVE ACADEMIC CONTEXT adalah satu-satunya active context.**

> **SCHOOL PROFILE menyimpan DEFAULT context, bukan active context.**

> **JADWAL CERDAS menghasilkan CANDIDATE.**

> **JADWAL adalah OPERATIONAL SCHEDULE.**

> **CANDIDATE tidak boleh mengubah COMMITTED SCHEDULE sebelum explicit commit.**

> **BLOCKING CONFLICT wajib mencegah commit.**

> **OPTIMIZATION harus explicit dan reviewable.**

> **NO INFINITE LOADING.**

> **NO SILENT MUTATION.**

> **IMPORT/EXPORT tetap contextual.**

> **Critical mutation harus traceable.**

> **Responsive = transformation, bukan sekadar shrinking.**

> **Correctness lebih penting daripada visual polish.**

---

# 69. BUILD ORDER (RECAP KONFIRMASI — TIDAK DIUBAH)

```text
01 Governance & Source of Truth
02 Product / IA Contract
03 Technical Foundation
04 Design Tokens
05 Application Shell
06 Foundation Components
07 Surface / Data / Form Systems
08 State / Feedback / Recovery System
09 Academic Context + Admin Profile
10 Core Data
11 Academic Core
12 Schedule Model + Slot Template
13 Schedule Domain & Validation Engine
14 Jadwal Cerdas
15 Jadwal Operational Workspace
16 Dashboard
17 Analytics
18 History
19 Notifications
20 AI Assistant
21 Import / Export / Template
22 Authentication / Authorization / Sync
23 Responsive
24 Accessibility
25 Performance
26 Security
27 Automated Testing
28 Visual Regression
29 Browser Precision QA
30 Build Gate
31 Release Candidate
32 Production Hardening
33 Production Release
```

**Dashboard tidak boleh dibangun dulu.**

---

# 70. IMPLEMENTATION MATRIX CONTRACT

Sebelum coding, seluruh specification dipetakan ke tabel berikut (per requirement):

| Kolom | Keterangan |
|---|---|
| ID | Identifier unik requirement |
| Specification | Rujukan bagian di dokumen ini |
| Build Phase | Nomor fase di Build Order (Bagian 69) |
| Route | Route/URL terkait |
| UI | Komponen visual terkait |
| Component | Komponen kode terkait |
| State | State layer terkait (Bagian 7) |
| Database | Tabel/kolom terkait |
| Domain | Entity/rule domain terkait |
| Application | Use case terkait |
| Engine | Engine terkait (conflict, jadwal cerdas, dst) |
| AI | Keterlibatan AI (jika ada) |
| Permission | Permission yang dibutuhkan |
| Test | Test yang mencakup requirement ini |
| Status | Belum / Sedang / Selesai / Diverifikasi |

Tidak boleh ada requirement yang:

```text
terlupakan
dianggap implicit
diam-diam dihilangkan
diganti dengan generic implementation
```

kecuali memang dinyatakan optional oleh specification.

---

# 71. PROJECT ROOT

Prioritas:

```text
D:\SAKALA-V2
```

Fallback:

```text
C:\SAKALA-V2
```

Tidak menyebarkan project ke Desktop/Downloads/Documents.

---

# 72. REPOSITORY STRUCTURE (RECAP BASELINE)

```text
SAKALA-V2/
│
├── apps/
│   ├── desktop/
│   └── web/
│
├── packages/
│   ├── ui/
│   ├── design-tokens/
│   ├── domain/
│   ├── application/
│   ├── data-access/
│   ├── validation/
│   └── config/
│
├── database/
├── migrations/
│
├── docs/
│   ├── specification/
│   ├── architecture/
│   ├── workflows/
│   └── qa/
│
├── assets/
│   ├── branding/
│   ├── splash/
│   └── icons/
│
├── tests/
│   ├── unit/
│   ├── component/
│   ├── integration/
│   ├── e2e/
│   └── visual/
│
├── scripts/
│
└── reports/
```

Struktur boleh bertambah secara terkontrol, tetapi tidak boleh disederhanakan sembarangan.

---

# 73. ARCHITECTURE (RECAP)

Layer resmi:

```text
Presentation
 ↓
Application
 ↓
Domain
 ↓
Data Access
 ↓
Database / External Service
```

**Presentation** menangani: routes, layouts, components, visual states, interaction, accessibility.

**Application** menangani: use cases, commands, queries, orchestration, workflows, permission checks, transaction boundaries.

**Domain** menangani: entities, value objects, invariants, schedule rules, conflict rules, state transitions.

**Data Access** menangani: repositories, queries, persistence, synchronization, cache.

Business logic tidak diletakkan di React component.

---

# 74. SOFTWARE BASELINE

Minimum:

```text
Visual Studio Code
Node.js LTS
Git
GitHub
Supabase
Vercel
Chrome / modern browser
```

Sudah tersedia (akun eksisting dipakai, bukan bikin baru):

```text
GitHub
Supabase
Vercel
```

Tidak menambahkan secara default:

```text
Docker
Kubernetes
Redis
separate PostgreSQL
cloud provider tambahan
```

kecuali benar-benar diperlukan specification/technical requirement.

---

# 75. ENVIRONMENT (RECAP)

Dipisahkan:

```text
development
test
staging
production
```

Tidak menggunakan production database untuk testing. Configuration tidak boleh di-hardcode.

---

# 76. BRANDING & SPLASH (RECAP)

Master Logo PNG transparent adalah **single source of truth**.

Tidak boleh: redraw, recolor, distort, crop, replace.

Splash state machine:

```text
BOOT
 ↓
ASSET READY
 ↓
SESSION CHECK
 ↓
PROFILE READY
 ↓
ACADEMIC CONTEXT READY
 ↓
CORE DATA READY
 ↓
SHELL READY
 ↓
READY
```

Failure path:

```text
FAILURE
 ↓
EXPLAIN
 ↓
RETRY
 ↓
SAFE EXIT
```

Tidak ada infinite spinner. Reduced motion harus menonaktifkan animasi glow/wire/node/logo/wordmark/exit.

---

# 77. ACTIVE ACADEMIC CONTEXT (RECAP)

Salah satu fondasi terpenting. Semua academic query/mutation menggunakan `academicContextId` — **tidak** menggunakan text label untuk menentukan context.

Switch context:

```text
Current Context
 ↓
Check Unsaved Changes
 ↓
Check Pending Operation
 ↓
Confirm if needed
 ↓
Load New Context
 ↓
Clear Invalid Workspace State
 ↓
Refresh Dependent Data
```

Juga wajib: cancel old query, prevent stale response, reset invalid filters, preserve valid filters, local loading, local error.

---

# 78. SCHOOL PROFILE (RECAP)

School Profile menyimpan **DEFAULT context** — tidak otomatis menjadi active context.

Fields: Nama, Jabatan, Nama Sekolah, Tahun Pelajaran, Semester.

Save flow:

```text
Validate
 ↓
Persist
 ↓
Update Cache
 ↓
Success
```

---

# 79. DESIGN SYSTEM (RECAP)

Token groups: Color, Typography, Spacing, Radius, Border, Shadow, Elevation, Motion, Breakpoint, Density, Icon, Z-index, Focus, Opacity.

Density: `Comfortable`, `Compact`. Compact wajib tersedia untuk: schedule, table, dense admin workspace.

Form control height: `36px Compact`, `44px Default`, `48px Large`.

---

# 80. APPLICATION SHELL (RECAP)

```text
HEADER / CONTEXT BAR
+
SIDEBAR
+
WORKSPACE
```

Header:

```text
LEFT   → Brand + navigation
CENTER → Global Search / Command Palette
RIGHT  → Connection + notification + profile
```

Sidebar: `Expanded 220–248px`, `Collapsed 64–72px`.

Command Palette: `Cmd/Ctrl + K` — mencakup route search, entity search, actions, recent actions, navigation.

---

# 81. FOUNDATION COMPONENTS (RECAP — DAFTAR LENGKAP WAJIB)

Wajib dibangun reusable:

```text
Button
Input
Select
Search
Checkbox
Radio
Switch
Badge
Tooltip
Popover
Context Menu
Dialog
Sheet
Toast
Skeleton
Spinner
Progress
Tabs
Segmented Control
Date Picker
Calendar
Data Table
Pagination
Empty State
Error State
```

Setiap component memiliki contract: anatomy, props, variants, sizes, states, keyboard, focus, loading, disabled, error, responsive, accessibility, motion.

> **Catatan status implementasi (Fase 1 SAKALA V2 saat ini):** baru Button, Input, Modal (≈Dialog), Card, Badge, Empty State, Error State, Skeleton yang dibangun. Select, Search (sebagai komponen reusable terpisah), Checkbox, Radio, Switch, Tooltip, Popover, Context Menu, Sheet, Toast, Spinner, Progress, Tabs, Segmented Control, Date Picker, Calendar, Data Table (generik/reusable), Pagination **belum dibangun** — menyusul di Step 06 lanjutan sebelum masuk ke core yang membutuhkannya (mis. Data Table generik sebelum Jadwal Operational Workspace, Date Picker/Calendar sebelum Akademik Core).

---

# 82. CORE DATA (RECAP)

Urutan:

```text
Guru
 ↓
Mata Pelajaran
 ↓
Kelas
 ↓
Ruangan
```

Semua harus context-aware dan memiliki lifecycle aktif/inaktif. Inactive entity tidak boleh digunakan untuk committed schedule baru. Historical data tetap readable.

---

# 83. ACADEMIC CORE (RECAP)

Temporal hierarchy:

```text
Tahun Ajaran
 ↓
Semester
 ↓
Periode Akademik
 ↓
Minggu
 ↓
Hari
 ↓
Jam Pelajaran
 ↓
Slot Jadwal
```

Break bukan teaching period. School days configurable.

---

# 84. SCHEDULE MODEL (RECAP)

Schedule Model = **konfigurasi**, bukan timetable. Memiliki: model name, start time, standard duration, maximum periods/day, active days, holidays, academic context, rombel usage, status.

Room mode: `Required`, `Optional`, `Not Used` — tidak boleh diinfer otomatis.

---

# 85. SCHEDULE DOMAIN (RECAP)

Minimum schedule assignment:

```text
scheduleId
academicContextId
classId
subjectId
teacherId
roomId
day
periodStart
periodEnd
activityType
status
source
versionId
createdAt
updatedAt
```

Source: `manual`, `generated`, `imported`, `ai_assisted`.

Status: `draft`, `candidate`, `committed`, `archived`, `cancelled`.

Committed schedule berada di schedule version.

---

# 86. CONFLICT ENGINE (RECAP)

Minimum conflict type:

```text
TEACHER_OVERLAP
CLASS_OVERLAP
ROOM_OVERLAP
FIXED_SLOT
INVALID_PERIOD
INACTIVE_ENTITY
JP_MISMATCH
MISSING_REQUIRED_FIELD
CONTEXT_MISMATCH
```

Severity: `Error`, `Warning`, `Info`. Error blocking → commit harus dicegah.

Conflict muncul di: slot, row, summary, validation panel. Click conflict → affected entity/slot.

---

# 87. JADWAL CERDAS (RECAP)

Pipeline:

```text
Load Context
 ↓
Select Scope
 ↓
Load Constraints
 ↓
Normalize
 ↓
Generate Candidate
 ↓
Validate
 ↓
Conflict Detection
 ↓
Candidate Review
 ↓
Optional Optimization
 ↓
Final Validation
 ↓
Commit
 ↓
Create Version
 ↓
Audit
```

Candidate tidak boleh overwrite committed schedule.

Optimization flow:

```text
Current Candidate
 ↓
Expected Changes
 ↓
Affected Classes
 ↓
Affected Teachers
 ↓
Affected Rooms
 ↓
Known Conflicts
 ↓
User chooses: KEEP CURRENT atau APPLY OPTIMIZATION
```

---

# 88. OPERATIONAL JADWAL (RECAP)

Views: Per Kelas, Per Guru, Per Ruangan, Harian, Mingguan.

Weekly desktop columns: `Monday`–`Saturday`.

Cell menampilkan: Subject, Teacher, Room, Activity, Status.

States: `Empty`, `Occupied`, `Fixed Activity`, `Conflict`, `Incomplete`, `Complete`, `Loading`, `Error`.

---

# 89. TARGET JP (RECAP)

Harus menampilkan per subject: target, scheduled, difference, completion %, state, action.

State: `Belum Mulai`, `Belum Lengkap`, `Lengkap`, `Melebihi Target`.

Click → affected schedule.

---

# 90. DASHBOARD (RECAP)

Baru dibuat setelah fondasi data/domain stabil.

Hierarchy:

```text
Academic Context
 ↓
Greeting / Workspace
 ↓
Key Metrics
 ↓
Primary Schedule Insight
 ↓
Workload
 ↓
Heatmap
 ↓
Upcoming Agenda
 ↓
Recent Activity
```

Bukan editing surface utama. Harus menangani: first use, empty, incomplete, normal, conflict, loading, offline, error.

---

# 91. ANALYTICS / HISTORY / NOTIFICATIONS (RECAP)

Analytics menjawab: *What happened? Why? What should I do?*

History merekam: who, what, when, context, entity, before, after, source, reason.

Notification kategori: `System`, `Schedule`, `Validation`, `Import`, `Sync`.

Priority: `Info`, `Success`, `Warning`, `Critical`.

---

# 92. AI GOVERNANCE (RECAP)

AI adalah **assistant**, bukan autonomous mutation engine.

Allowed: explain, summarize, recommend, detect pattern, assist scheduling.

Critical flow:

```text
AI Suggestion
 ↓
Preview
 ↓
Validation
 ↓
User Confirmation
 ↓
Commit
```

Tidak boleh: AI → silent database mutation.

---

# 93. IMPORT / EXPORT (RECAP)

Import:

```text
Select Core
 ↓
Template
 ↓
Upload
 ↓
Parse
 ↓
Map
 ↓
Preview
 ↓
Validate
 ↓
Errors
 ↓
Confirm
 ↓
Commit
 ↓
Summary
```

Export:

```text
Filter
 ↓
Columns
 ↓
Format
 ↓
Generate
 ↓
Download
```

Tetap context-aware.

---

# 94. AUTH / SYNC (RECAP)

Minimum: login, session, logout, permissions, authorization, expiry, retry, connection state.

Action permissions: `view`, `create`, `edit`, `delete`, `import`, `export`, `generate`, `optimize`, `commit`.

Connection state: `Online`, `Connecting`, `Offline`, `Syncing`, `Sync Error`.

Tidak boleh mengklaim *synced* jika sebenarnya hanya *queued*.

---

# 95. QUALITY (RECAP)

Responsive priority: `Desktop Chrome` → `Laptop` → `Tablet` → `Mobile`. Breakpoints specification tetap digunakan (lihat Bagian 43).

Accessibility: keyboard, focus, semantic, ARIA, contrast, screen reader, touch target, reduced motion, no color-only meaning.

Performance: stable keys, memoized cells, selective updates, virtualization bila perlu.

Security: authentication, authorization, validation, sanitized errors, data access control, audit critical mutation.

---

# 96. TESTING (RECAP)

Urutan:

```text
Unit
 ↓
Component
 ↓
Integration
 ↓
Workflow
 ↓
E2E
 ↓
Visual
```

Critical workflow semuanya harus tercakup.

---

# 97. RACE CONDITION PROTECTION (RECAP)

Wajib melindungi stale request:

```text
Context A
 ↓
Switch B
 ↓
A returns
```

Response A tidak boleh menimpa B. Digunakan sesuai kebutuhan: `requestId`, `contextId`, abort/cancel, version check.

---

# 98. DOUBLE SUBMISSION PROTECTION (RECAP)

Mutation lifecycle:

```text
Idle
 ↓
Submitting
 ↓
Success / Error
```

Tidak boleh duplicate request.

---

# 99. UNSAVED CHANGES PROTECTION (RECAP)

Jika tidak ada perubahan → leave langsung. Jika ada perubahan → confirm.

Berlaku untuk: route change, browser close, context switch, entity switch.

---

# 100. OPTIMISTIC UI POLICY (RECAP)

Hanya untuk low-risk deterministic rollback.

Tidak boleh optimistic untuk: schedule commit, bulk import, destructive delete, context switch, optimization.

---

# 101. DATA INTEGRITY (RECAP)

Setiap mutation memiliki: Precondition, Mutation, Postcondition, Side Effects, Audit Event.

Schedule commit harus:

```text
Candidate valid
 ↓
Persist schedule + version
 ↓
Readable committed schedule
 ↓
Recalculate metrics/conflicts
 ↓
History
 ↓
Notification jika diperlukan
```

---

# 102. VERSIONING (RECAP)

Schedule version mendukung: Create, View, Compare, Activate, Archive, Restore.

History tidak boleh ditimpa.

---

# 103. ZIP IMPLEMENTATION SYSTEM *(baru)*

Setiap milestone dikirim sebagai:

```text
SAKALA-V2-PACK-XX.zip
```

Patch ZIP hanya berisi file yang diperlukan (bukan seluruh project). Jika perlu baseline penuh, dikirim sebagai:

```text
FULL BASELINE
```

---

# 104. SAKALA BUILD & DIAGNOSTIC TOOLCHAIN *(baru)*

Tujuan: **tidak perlu mengirim seluruh project ketika terjadi error.**

Workflow normal:

```text
PACK
 ↓
PRE-FLIGHT
 ↓
APPLY
 ↓
DOCTOR
 ↓
AUDIT
 ↓
BUILD
 ↓
TEST
 ↓
PASS
```

Workflow saat error:

```text
ERROR
 ↓
CAPTURE
 ↓
CLASSIFY
 ↓
ROOT CAUSE
 ↓
MINIMAL SOURCE SNAPSHOT
 ↓
AI HANDOFF
 ↓
FIX PATCH
 ↓
BACKUP
 ↓
APPLY FIX
 ↓
VERIFY
 ↓
REGRESSION CHECK
 ↓
PASS
```

---

# 105. SELF-DIAGNOSING PACK *(baru)*

Setiap ZIP bukan hanya source — melainkan paket diagnostik mandiri:

```text
SAKALA-V2-PACK-XX.zip
│
├── PACK-MANIFEST.json
├── PATCH-NOTES.md
├── README-PACK.md
│
├── source/
├── database/
├── scripts/
├── audit/
├── fixes/
├── docs/
└── reports/
```

---

# 106. PACK-MANIFEST *(baru)*

Setiap pack membawa informasi berikut di `PACK-MANIFEST.json`, sehingga script tidak perlu menebak apa yang diperlukan:

```text
packId
phase
version
requiredNode
packageManager
dependencies
devDependencies
environmentVariables
migrations
scripts
audits
tests
build
rollback
verification
```

---

# 107. COMMAND SYSTEM *(baru)*

User tidak perlu menghafal command. Command utama:

```text
Apply     .\scripts\SAKALA-APPLY.ps1
Doctor    .\scripts\SAKALA-DOCTOR.ps1
Audit     .\scripts\SAKALA-AUDIT.ps1
Fix       .\scripts\SAKALA-FIX.ps1
Verify    .\scripts\SAKALA-VERIFY.ps1
Rollback  .\scripts\SAKALA-ROLLBACK.ps1
```

---

# 108. CONTEXT-AWARE AUDIT *(baru)*

Audit tidak menjalankan semua pemeriksaan setiap saat — audit mengikuti pack yang sedang diterapkan.

Contoh pemetaan:

```text
Pack 00              → Environment / Git / Node / Workspace / Build
Pack Design           → Tokens / UI / exports / build
Pack Schedule Domain  → Entities / invariants / tests
Pack Conflict         → Teacher / class / room / fixed slot / JP
Pack Auth             → Auth / permission / RLS / security
```

Ini menghemat waktu dan limit.

---

# 109. ERROR REPORT *(baru)*

Jika error ditemukan, disimpan di:

```text
reports/latest/errors/ERROR-001/
```

Berisi:

```text
ERROR.md
STACKTRACE.txt
COMMAND.txt
ENVIRONMENT.txt
SOURCE-SNAPSHOT.txt
affected-files.txt
dependency-context.txt
FIX.md
```

Hanya source yang relevan yang dikumpulkan.

---

# 110. ERROR ROOT-CAUSE DEDUPLICATION *(baru)*

Jika 47 error berasal dari 1 penyebab:

```text
47 errors
 ↓
Root Cause Analysis
 ↓
1 PRIMARY ERROR
 ↓
47 affected locations
```

AI fokus ke akar masalah — ini salah satu mekanisme utama penghematan limit.

---

# 111. SAFE FIX ENGINE *(baru)*

Fix script tidak boleh blind replacement. Sebelum patch:

```text
Target exists?
 ↓
Expected content/version?
 ↓
Hash/context match?
 ↓
YES → Backup → Patch
NO  → Abort safely
```

Tidak boleh merusak source jika baseline sudah berubah.

---

# 112. AUTOMATIC FIX VERIFICATION *(baru)*

Setelah patch:

```text
Patch
 ↓
Formatter
 ↓
Typecheck
 ↓
Target test
 ↓
Related test
 ↓
Build
 ↓
Audit
```

Hasil harus membuktikan fix, bukan sekadar diasumsikan.

---

# 113. REGRESSION DETECTION *(baru)*

Contoh laporan:

```text
Resolved:  ERROR-001
New:       ERROR-017
Unchanged: ERROR-004
```

System tidak akan menyatakan success jika fix menghasilkan regression baru.

---

# 114. BACKUP & ROLLBACK *(baru)*

Sebelum fix:

```text
Current
 ↓
Backup
 ↓
Apply
 ↓
Verify
```

Jika gagal: `ROLLBACK`.

---

# 115. AI HANDOFF *(baru)*

Setiap failure menghasilkan `reports/latest/AI-HANDOFF.md`, berisi hanya informasi yang diperlukan:

```text
phase
pack
execution ID
status
root cause
errors
affected files
relevant source
environment
dependencies
failed command
expected result
actual result
fix recommendation
files to modify
verification commands
```

Sehingga workflow AI menjadi:

> Baca `reports/latest/AI-HANDOFF.md`, perbaiki error yang dilaporkan, dan jangan membaca seluruh project kecuali diperlukan.

---

# 116. SUCCESS / FAILURE REPORT *(baru)*

Report tidak hanya dibuat saat gagal — setiap execution menghasilkan report.

Contoh PASS:

```text
Environment ........ PASS
Dependencies ....... PASS
TypeScript ......... PASS
Tests .............. PASS
Build .............. PASS
Audit .............. PASS

Errors: 0
Warnings: 0

STATUS: HEALTHY
```

Contoh FAIL:

```text
Environment ........ PASS
Dependencies ....... PASS
TypeScript ......... FAIL
Tests .............. SKIPPED
Build .............. SKIPPED

Blocking Errors: 1

STATUS: FAILED
```

---

# 117. EXIT CODE *(baru)*

Toolchain memiliki machine-readable exit code:

```text
0 = PASS
1 = WARNING
2 = BLOCKING ERROR
3 = ENVIRONMENT ERROR
4 = PATCH ERROR
5 = VERIFICATION ERROR
6 = ROLLBACK
```

---

# 118. GIT COMMIT STRUCTURE (RECAP)

Git dipakai sejak awal. Commit terstruktur mengikuti fase:

```text
01-governance
02-foundation
03-design-tokens
04-shell
05-components
06-data
07-academic
08-schedule-domain
09-conflict-engine
10-jadwal-cerdas
11-jadwal
12-dashboard
13-analytics
14-history
15-notification
16-ai
17-import-export
18-auth
19-responsive
20-accessibility
21-testing
22-qa
23-release
```

Tidak giant unrelated commit.

---

# 119. SUPABASE (RECAP)

Digunakan sebagai backend database/auth sesuai kebutuhan. Wajib: migrations, PostgreSQL schema, indexes, constraints, relations, RLS, authentication, audit, migration history.

Tidak mengandalkan production schema yang hanya dibuat manual melalui dashboard (semua perubahan skema harus lewat migration file, bukan klik manual tanpa jejak).

---

# 120. VERCEL (RECAP)

Workflow:

```text
GitHub
 ↓
Vercel
 ↓
SAKALA
```

Environment: `Development`, `Preview`, `Production`. Secrets tidak masuk Git.

---

# 121. DEFINITION OF DONE (RECAP)

Feature baru tidak dianggap selesai hanya karena tampil. Harus menangani sesuai kebutuhan: UI, Interaction, State, Data, Validation, Error, Loading, Empty, Permission, Responsive, Accessibility, Testing, Audit.

---

# 122. PHASE CONTROL *(baru)*

Setelah setiap phase: **STOP**, lalu terbitkan **PHASE REPORT** berisi:

```text
Completed
Files Created
Files Modified
Database Changes
Tests
Visual QA
Specification Requirements Covered
Remaining Requirements
Known Issues
ZIP
Next Phase
```

Kemudian menunggu instruksi eksplisit: `CONTINUE PHASE XX`.

---

# 123. PHASE 00 — SCOPE *(baru)*

Phase 00 hanya mencakup:

```text
Local project folder
 ↓
Repository
 ↓
Git
 ↓
GitHub
 ↓
Workspace
 ↓
TypeScript
 ↓
Environment
 ↓
Architecture directories
 ↓
Docs
 ↓
Scripts
 ↓
Tests
 ↓
README
 ↓
Build verification
 ↓
Diagnostic Toolchain foundation
```

Tidak membangun: ❌ Dashboard, ❌ Jadwal, ❌ Jadwal Cerdas, ❌ AI, ❌ Full database, ❌ Advanced UI.

Target: **clean, reproducible, buildable SAKALA foundation.**

---

# 124. PHASE 00 — FOUNDATION CAPABILITIES *(baru)*

Phase 00 bukan hanya membuat folder project, tetapi menghasilkan kapabilitas:

```text
SAKALA-V2/
│
├── architecture
├── workspace
├── TypeScript
├── environment
├── Git
├── docs
├── tests
├── scripts
├── reports
└── diagnostic toolchain
```

Sehingga mulai Pack 00, sudah tersedia kemampuan: `APPLY`, `AUDIT`, `DOCTOR`, `REPORT`, `FIX`, `VERIFY`, `ROLLBACK`.

---

# 125. RELEASE GATES (RECAP)

```text
Gate A — Foundation
Gate B — Data
Gate C — Schedule
Gate D — Experience
Gate E — Quality
Gate F — Release
```

Gate F mencakup: production build, migrations, backup, monitoring, rollback plan, release notes.

---

# 126. FINAL SPECIFICATION AUDIT (RECAP)

Sebelum production: **SAKALA V2.3 FINAL SPECIFICATION AUDIT**, dengan format tabel:

| Requirement | Implemented | Tested | Verified | Location | Evidence |
|---|---|---|---|---|---|

Tidak boleh ada unexplained:

```text
TODO
FIXME
placeholder
fake functionality
dead button
missing route
missing database operation
missing permission
missing validation
missing error/loading state
missing responsive
missing accessibility
undocumented workaround
```

---

# 127. FINAL WORKFLOW — DUAL TRACK *(baru)*

Project berjalan dengan dua jalur bersamaan, disinkronkan pada setiap milestone:

**PRODUCT BUILD**

```text
SPEC
 ↓
ARCHITECTURE
 ↓
FOUNDATION
 ↓
DATA
 ↓
DOMAIN
 ↓
SCHEDULE
 ↓
EXPERIENCE
 ↓
QUALITY
 ↓
RELEASE
```

**ENGINEERING SAFETY NET**

```text
PACK
 ↓
PRE-FLIGHT
 ↓
APPLY
 ↓
AUDIT
 ↓
DOCTOR
 ↓
REPORT
 ↓
FIX
 ↓
VERIFY
 ↓
REGRESSION
 ↓
ROLLBACK / PASS
```

---

# 128. BASELINE STATUS TRACKER

| Area | Status |
|---|---|
| Master Specification | ✅ Locked |
| Build Order | ✅ Locked |
| Product Architecture | ✅ Locked |
| Technical Architecture | ✅ Baseline |
| Design System Direction | ✅ Locked |
| Schedule Architecture | ✅ Locked |
| Conflict Engine | ✅ Locked |
| AI Governance | ✅ Locked |
| ZIP Pack System | ✅ Locked |
| Incremental Implementation | ✅ Locked |
| Diagnostic Toolchain | ✅ Added |
| Self-Diagnosing Pack | ✅ Added |
| Error Report | ✅ Added |
| AI Handoff | ✅ Added |
| Safe Fix Script | ✅ Added |
| Verification | ✅ Added |
| Regression Detection | ✅ Added |
| Backup/Rollback | ✅ Added |
| Limit-Efficient Workflow | ✅ Added |

---

# 129. DOCUMENT STATUS (v2.3 + ADDENDUM)

**SAKALA V2.3 — HARDENED FULL BUILD CONTRACT + IMPLEMENTATION BASELINE ADDENDUM**

Part I (Bagian 0–65) tetap menjadi rujukan teknis detail. Part II (Bagian 66–128) mengunci **status proyek, urutan eksekusi per-pack, dan safety-net engineering** (diagnostic toolchain, error handoff, rollback) sebagai lapisan operasional di atas Part I.

**Target akhir tidak berubah:**

> Developer dapat membaca dokumen ini dari atas ke bawah dan mengetahui apa yang harus dibangun, urutan pembangunannya, aturan perilakunya, state yang harus ditangani, cara validasinya, dan kondisi yang harus dipenuhi sebelum release — sekarang dilengkapi cara mendiagnosis dan memperbaiki masalah tanpa mengirim ulang seluruh project.
