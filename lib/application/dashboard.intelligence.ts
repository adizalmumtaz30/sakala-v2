import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleAssignmentRepository } from "@/lib/data-access/scheduleAssignment.repository";
import { jamPelajaranRepository } from "@/lib/data-access/jamPelajaran.repository";
import { auditLogRepository } from "@/lib/data-access/auditLog.repository";
import type { HariSekolah } from "@/lib/domain/jamPelajaran";

export interface DashboardHeatmapDay { day: HariSekolah; label: string; total: number; level: 0|1|2|3|4; }
export interface DashboardAgendaEntry { id:string; dayLabel:string; time:string; subject:string; teacher:string; teacherId:string|null; className:string; room:string|null; }
export interface DashboardActivityEntry { id:string; action:string; entityType:string; entityLabel:string|null; createdAt:string; }

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

function humanizeActivity(action:string, entityType:string, entityLabel:string|null){
  const actionKey=action.trim().toLowerCase().replace(/[- ]+/g,"_");
  const entityKey=entityType.trim().toLowerCase().replace(/[- ]+/g,"_");
  const verb=ACTION_LABEL[actionKey]??"Mengubah";
  const entity=ENTITY_LABEL[entityKey]??entityType.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  const label=entityLabel?.trim();
  const meaningfulLabel=label && !/^\d+$/.test(label) && label.length<=80 ? label : null;
  return meaningfulLabel ? `${verb} ${entity} · ${meaningfulLabel}` : `${verb} ${entity}`;
}

export async function getDashboardIntelligence(supabase:SupabaseClient, contextId:string, guruList:any[], mapelList:any[], kelasList:any[], ruanganList:any[]){
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
  const slots=new Map(jam.filter(j=>j.status==="aktif"&&j.jenis==="pembelajaran").map(j=>[`${j.hari}:${j.nomorUrut}`,j]));

  const totals=new Map<HariSekolah,number>();
  for(const a of committed) totals.set(a.day,(totals.get(a.day)??0)+(a.periodEnd-a.periodStart+1));
  const max=Math.max(...DAYS.map(d=>totals.get(d)??0),1);
  const heatmap=DAYS.map(day=>{const total=totals.get(day)??0;const r=total/max;const level=(total===0?0:r<=.25?1:r<=.5?2:r<=.75?3:4) as 0|1|2|3|4;return {day,label:LABEL[day],total,level};});

  const current=todayIndex();
  const upcoming=committed.map(a=>({a,distance:(DAYS.indexOf(a.day)-current+7)%7})).sort((x,y)=>x.distance-y.distance||x.a.periodStart-y.a.periodStart).slice(0,6).map(({a})=>{
    const s=slots.get(`${a.day}:${a.periodStart}`);
    const teacherName=guru.get(a.teacherId) ?? "Guru";
    const className=kelas.get(a.classId) ?? "Kelas";
    const subject=mapel.get(a.subjectId) ?? "Mata pelajaran";
    return {id:a.id,dayLabel:LABEL[a.day],time:s?`${s.waktuMulai}–${s.waktuSelesai}`:`Jam ke-${a.periodStart}`,subject,teacher:teacherName,teacherId:guru.has(a.teacherId)?a.teacherId:null,className,room:a.roomId?ruang.get(a.roomId)??null:null};
  });
  const recentActivity=audit.items.map(i=>({id:i.id,action:humanizeActivity(i.action,i.entityType,i.entityLabel),entityType:i.entityType,entityLabel:i.entityLabel,createdAt:i.createdAt}));
  return {heatmap,upcomingAgenda:upcoming,recentActivity};
}