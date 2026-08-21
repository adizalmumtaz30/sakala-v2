import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";
import { auditLogRepository } from "@/lib/data-access/auditLog.repository";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";
import { classifyBeban, type Guru } from "@/lib/domain/guru";

export interface DashboardHeatmapDay { day: HariSekolah; label: string; total: number; level: 0|1|2|3|4; }
export interface DashboardAgendaEntry { id:string; dayLabel:string; time:string; subject:string; teacher:string; teacherId:string|null; className:string; room:string|null; }
export interface DashboardActivityEntry { id:string; action:string; entityType:string; entityLabel:string|null; createdAt:string; }
export interface DashboardBebanDistribution { ringan:number; normal:number; berat:number; }
export interface DashboardHeatmapCell { periode:number; time:string; total:number; level:0|1|2|3|4; kelasCount:number; guruCount:number; ruanganCount:number; }
export interface DashboardHeatmapGridDay { day:HariSekolah; label:string; cells:DashboardHeatmapCell[]; }
export interface DashboardRoomLite { id:string; nama:string; }
export interface DashboardWorkloadFullEntry { guruId:string; namaGuru:string; totalJamMengajar:number; beban:"ringan"|"normal"|"berat"; }

const DAYS:HariSekolah[]=["senin","selasa","rabu","kamis","jumat","sabtu"];
const LABEL:Record<HariSekolah,string>={senin:"Senin",selasa:"Selasa",rabu:"Rabu",kamis:"Kamis",jumat:"Jumat",sabtu:"Sabtu",minggu:"Minggu"};

function todayIndex(){
  const d=new Intl.DateTimeFormat("en-US",{weekday:"long",timeZone:"Asia/Jakarta"}).format(new Date()).toLowerCase();
  return ({monday:0,tuesday:1,wednesday:2,thursday:3,friday:4,saturday:5,sunday:0} as Record<string,number>)[d]??0;
}

const ENTITY_LABEL:Record<string,string>={
  jadwal:"Jadwal", schedule:"Jadwal", schedule_assignment:"Jadwal", guru:"Guru", mata_pelajaran:"Mata Pelajaran",
  kelas:"Kelas", ruangan:"Ruangan", target_jp:"Target JP", pembagian_mengajar:"Pembagian Mengajar", akademik:"Akademik",
};
const ACTION_LABEL:Record<string,string>={
  create:"Menambahkan", created:"Menambahkan", insert:"Menambahkan", update:"Memperbarui", updated:"Memperbarui", edit:"Memperbarui",
  delete:"Menghapus", deleted:"Menghapus", remove:"Menghapus", import:"Mengimpor", commit:"Menetapkan", committed:"Menetapkan",
};

export function humanizeActivity(action:string, entityType:string, entityLabel:string|null){
  const actionKey=action.trim().toLowerCase().replace(/[- ]+/g,"_");
  const entityKey=entityType.trim().toLowerCase().replace(/[- ]+/g,"_");
  const verb=ACTION_LABEL[actionKey]??"Mengubah";
  const entity=ENTITY_LABEL[entityKey]??entityType.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const label=entityLabel?.trim();
  const meaningfulLabel=label && !/^\d+$/.test(label) && label.length<=80 ? label : null;
  return meaningfulLabel ? `${verb} ${entity} · ${meaningfulLabel}` : `${verb} ${entity}`;
}

export async function getDashboardIntelligence(supabase:SupabaseClient, contextId:string, guruList:Guru[], mapelList:any[], kelasList:any[], ruanganList:any[]){
  const [assignments,jam,audit]=await Promise.all([
    scheduleAssignmentRepository.findByContext(supabase,contextId),
    jamPelajaranRepository.findByContext(supabase,contextId),
    auditLogRepository.findMany(supabase,{academicContextId:contextId,limit:6}),
  ]);
  const committed=assignments.filter(a=>a.status==="committed");
  const guru=new Map(guruList.map(g=>[g.id,g.namaGuru]));
  const mapel=new Map(mapelList.map(m=>[m.id,m.nama]));
  const kelas=new Map(kelasList.map(k=>[k.id,`${k.tingkat} ${k.namaRombel}`]));
  const ruang=new Map(ruanganList.map(r=>[r.id,r.nama]));
  const pembelajaranJam=jam.filter(j=>j.status==="aktif"&&j.jenis==="pembelajaran");
  const slots=new Map(pembelajaranJam.map(j=>[`${j.hari}:${j.nomorUrut}`,j]));

  const totals=new Map<HariSekolah,number>();
  for(const a of committed) totals.set(a.day,(totals.get(a.day)??0)+(a.periodEnd-a.periodStart+1));
  const max=Math.max(...DAYS.map(d=>totals.get(d)??0),1);
  const heatmap=DAYS.map(day=>{const total=totals.get(day)??0;const r=total/max;const level=(total===0?0:r<=.25?1:r<=.5?2:r<=.75?3:4) as 0|1|2|3|4;return {day,label:LABEL[day],total,level};});

  // Heatmap Jadwal grid penuh: hari x periode pembelajaran, cell = jumlah assignment committed yang menutupi periode itu,
  // plus breakdown kelas/guru/ruangan unik (utk tooltip custom) — dipakai reusable jg utk filter per-ruangan.
  function buildHeatmapGrid(subset: typeof committed): DashboardHeatmapGridDay[] {
    const cellCounts = new Map<string, number>();
    const cellKelas = new Map<string, Set<string>>();
    const cellGuru = new Map<string, Set<string>>();
    const cellRuang = new Map<string, Set<string>>();
    for (const a of subset) {
      for (let p = a.periodStart; p <= a.periodEnd; p++) {
        const key = `${a.day}:${p}`;
        cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
        if (!cellKelas.has(key)) cellKelas.set(key, new Set());
        if (!cellGuru.has(key)) cellGuru.set(key, new Set());
        if (!cellRuang.has(key)) cellRuang.set(key, new Set());
        cellKelas.get(key)!.add(a.classId);
        cellGuru.get(key)!.add(a.teacherId);
        if (a.roomId) cellRuang.get(key)!.add(a.roomId);
      }
    }
    const gridMax = Math.max(...Array.from(cellCounts.values()), 1);
    return DAYS.map(day => {
      const periods = pembelajaranJam.filter(j => j.hari === day).sort((x, y) => x.nomorUrut - y.nomorUrut);
      const cells = periods.map(j => {
        const key = `${day}:${j.nomorUrut}`;
        const total = cellCounts.get(key) ?? 0;
        const r = total / gridMax;
        const level = (total === 0 ? 0 : r <= .25 ? 1 : r <= .5 ? 2 : r <= .75 ? 3 : 4) as 0 | 1 | 2 | 3 | 4;
        return { periode: j.nomorUrut, time: `${j.waktuMulai}–${j.waktuSelesai}`, total, level, kelasCount: cellKelas.get(key)?.size ?? 0, guruCount: cellGuru.get(key)?.size ?? 0, ruanganCount: cellRuang.get(key)?.size ?? 0 };
      });
      return { day, label: LABEL[day], cells };
    });
  }
  const heatmapGrid = buildHeatmapGrid(committed);
  const rooms: DashboardRoomLite[] = ruanganList.map(r => ({ id: r.id, nama: r.nama }));
  const heatmapGridByRoom: Record<string, DashboardHeatmapGridDay[]> = {};
  for (const room of rooms) heatmapGridByRoom[room.id] = buildHeatmapGrid(committed.filter(a => a.roomId === room.id));

  // Distribusi Beban Guru (Ringan/Normal/Berat) — semua guru aktif, termasuk yang belum punya jadwal committed (0 JP = ringan).
  const jamByGuruId=new Map<string,number>();
  for(const a of committed) jamByGuruId.set(a.teacherId,(jamByGuruId.get(a.teacherId)??0)+(a.periodEnd-a.periodStart+1));
  const guruAktif=guruList.filter(g=>g.status==="aktif");
  const workloadFull=guruAktif.map(g=>{
    const totalJamMengajar=jamByGuruId.get(g.id)??0;
    return {guruId:g.id,namaGuru:g.namaGuru,totalJamMengajar,beban:classifyBeban(totalJamMengajar)};
  }).sort((a,b)=>b.totalJamMengajar-a.totalJamMengajar);
  const bebanDistribution=workloadFull.reduce((acc,w)=>{acc[w.beban]+=1;return acc;},{ringan:0,normal:0,berat:0} as DashboardBebanDistribution);

  const current=todayIndex();
  const upcoming=committed.map(a=>({a,distance:(DAYS.indexOf(a.day)-current+7)%7})).sort((x,y)=>x.distance-y.distance||x.a.periodStart-y.a.periodStart).slice(0,6).map(({a})=>{
    const s=slots.get(`${a.day}:${a.periodStart}`);
    const teacherName=guru.get(a.teacherId) ?? "Guru";
    const className=kelas.get(a.classId) ?? "Kelas";
    const subject=mapel.get(a.subjectId) ?? "Mata pelajaran";
    return {id:a.id,dayLabel:LABEL[a.day],time:s?`${s.waktuMulai}–${s.waktuSelesai}`:`Jam ke-${a.periodStart}`,subject,teacher:teacherName,teacherId:guru.has(a.teacherId)?a.teacherId:null,className,room:a.roomId?ruang.get(a.roomId)??null:null};
  });
  const recentActivity=audit.items.map(i=>({id:i.id,action:humanizeActivity(i.action,i.entityType,i.entityLabel),entityType:i.entityType,entityLabel:i.entityLabel,createdAt:i.createdAt}));
  return {heatmap,heatmapGrid,rooms,heatmapGridByRoom,bebanDistribution,workloadFull,upcomingAgenda:upcoming,recentActivity};
}