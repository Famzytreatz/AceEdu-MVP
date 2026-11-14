import { useEffect, useMemo, useState } from "react"
import { Users, Activity, CalendarDays, TrendingUp, RefreshCw, Download, GraduationCap, BarChart3, ClipboardCheck, Award } from "lucide-react"
import { getDashboard, getAcademicSetup, getClassPerformance } from "../data/api"
import LoadingSpinner from "../components/ui/LoadingSpinner"

function useReportsResource() {
  const [data,setData] = useState(null)
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState("")
  const [revision,setRevision] = useState(0)
  const refresh=()=>setRevision(v=>v+1)
  useEffect(()=>{
    let active=true
    setLoading(true);setError("")
    Promise.all([getDashboard(),getAcademicSetup()]).then(async ([dashboard,setup])=>{
      const results=await Promise.all(setup.classes.map(async schoolClass=>({schoolClass,performance:await getClassPerformance(schoolClass.id)})))
      if(active)setData({dashboard,setup,results})
    }).catch(err=>{if(active)setError(err.message||"Unable to build reports.")}).finally(()=>{if(active)setLoading(false)})
    return ()=>{active=false}
  },[revision])
  return {data,loading,error,refresh}
}
function Metric({Icon,label,value,detail,tone}){return <article className={`ace-reports__metric is-${tone}`}><span className="ace-reports__metric-icon"><Icon size={18}/></span><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>}
function percent(value){return value==null?"—":`${Number(value).toFixed(1)}%`}
function csvCell(value){return `"${String(value??"").replaceAll('"','""')}"`}

export default function ReportsAnalyticsWorkspace(){
  const resource=useReportsResource()
  const [activeTab,setActiveTab]=useState("overview")
  const [classFilter,setClassFilter]=useState("all")
  const data=resource.data
  const filteredResults=(data?.results||[]).filter(x=>classFilter==="all"||x.schoolClass.id===classFilter)
  const distribution=data?.dashboard.classDistribution||[]
  const trend=data?.dashboard.studentTrend||[]
  const attendance=useMemo(()=>{
    const out={present:0,absent:0,late:0,excused:0,total:0}
    for(const {performance} of data?.results||[])for(const key of ["present","absent","late","excused"]){const n=Number(performance.metrics.attendance?.[key])||0;out[key]+=n;out.total+=n}
    return out
  },[data])
  const average=filteredResults.map(x=>x.performance.metrics.classAverage).filter(x=>x!=null)
  const schoolAverage=average.length?average.reduce((a,b)=>a+Number(b),0)/average.length:null
  const maxTrend=Math.max(1,...trend.map(x=>Number(x.total)||0))
  const maxDistribution=Math.max(1,...distribution.map(x=>Number(x.total)||0))
  function exportReport(){
    const rows=[["Class","Students","Assessments","Results recorded","Class average (%)"],...filteredResults.map(({schoolClass,performance})=>[schoolClass.name,performance.metrics.studentCount,performance.metrics.assessmentCount,performance.metrics.assessedStudentCount,performance.metrics.classAverage??""])]
    const csv=rows.map(row=>row.map(csvCell).join(",")).join("\r\n")
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}))
    const a=document.createElement("a");a.href=url;a.download="acedu-class-performance-report.csv";a.click();URL.revokeObjectURL(url)
  }
  return <section className="ace-reports" aria-label="Reports and analytics">
    <header className="ace-reports__hero"><div><span className="ace-reports__eyebrow"><span/> SCHOOL INTELLIGENCE · PREMIUM</span><h1>Reports & analytics</h1><p>Turn your school's saved records into clear operational and academic insight.</p><div className="ace-reports__hero-meta"><span><Activity size={14}/> Live school records</span><span><BarChart3 size={14}/> {data?.setup.classes.length??"—"} classes in analysis</span></div></div><div className="ace-reports__hero-art"><div className="ace-reports__art-bars">{[36,58,48,78,62,94,74].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div><div className="ace-reports__art-orbit"><TrendingUp size={28}/></div></div></header>
    {resource.error&&<div className="ace-reports__alert" role="alert">{resource.error}<button type="button" onClick={resource.refresh}><RefreshCw size={14}/> Retry</button></div>}
    <div className="ace-reports__toolbar"><div className="ace-reports__tabs">{[["overview","Overview"],["attendance","Attendance"],["academics","Academic performance"]].map(([id,label])=><button type="button" key={id} className={activeTab===id?"is-active":""} onClick={()=>setActiveTab(id)}>{label}</button>)}</div><div className="ace-reports__toolbar-actions"><button type="button" className="ace-reports__secondary" onClick={resource.refresh} disabled={resource.loading}><RefreshCw size={14}/> Refresh</button><button type="button" className="ace-reports__primary" onClick={exportReport} disabled={!data}><Download size={14}/> Export class report</button></div></div>
    {resource.loading?<div className="ace-reports__loading"><LoadingSpinner/> Analysing school records…</div>:data&&<>
      <div className="ace-reports__metrics">
        <Metric Icon={Users} label="Students enrolled" value={data.dashboard.metrics.students??0} detail="Current student registry" tone="blue"/>
        <Metric Icon={ClipboardCheck} label="Attendance entries" value={attendance.total.toLocaleString()} detail={`${attendance.present.toLocaleString()} present · ${attendance.absent.toLocaleString()} absent`} tone="teal"/>
        <Metric Icon={GraduationCap} label="Academic classes" value={data.setup.classes.length} detail={`${data.setup.academicYears.length} configured academic sessions`} tone="violet"/>
        <Metric Icon={Award} label="Average class score" value={percent(schoolAverage)} detail={average.length?"Average of available class averages":"No scored assessments yet"} tone="amber"/>
      </div>
      {activeTab==="overview"&&<div className="ace-reports__grid">
        <section className="ace-reports__panel ace-reports__trend"><div className="ace-reports__section-heading"><div><span className="ace-reports__eyebrow">ENROLLMENT MOVEMENT</span><h2>Student registration trend</h2><p>New student entries recorded in the available reporting window.</p></div></div>{trend.length?<div className="ace-reports__trend-chart"><div className="ace-reports__y-labels"><span>{maxTrend}</span><span>{Math.round(maxTrend/2)}</span><span>0</span></div><div className="ace-reports__columns">{trend.map(item=><div className="ace-reports__column" key={item.month}><div className="ace-reports__bar-track"><i style={{height:`${Math.max(3,(Number(item.total)||0)/maxTrend*100)}%`}}/><b>{item.total}</b></div><small>{item.month}</small></div>)}</div></div>:<div className="ace-reports__empty">Enrollment history will appear when dated student records are available.</div>}</section>
        <section className="ace-reports__panel"><div className="ace-reports__section-heading"><div><span className="ace-reports__eyebrow">CLASS COMPOSITION</span><h2>Students by class</h2><p>Current registered student distribution.</p></div></div>{distribution.length?<div className="ace-reports__distribution">{distribution.map(item=><div key={item.className}><div><span>{item.className}</span><strong>{item.total}</strong></div><div className="ace-reports__progress"><i style={{width:`${Math.max(1,(Number(item.total)||0)/maxDistribution*100)}%`}}/></div></div>)}</div>:<div className="ace-reports__empty">No class distribution records yet.</div>}</section>
        <section className="ace-reports__panel ace-reports__wide"><div className="ace-reports__section-heading"><div><span className="ace-reports__eyebrow">ACADEMIC SNAPSHOT</span><h2>Class performance</h2><p>Assessment coverage and available class averages.</p></div><button type="button" className="ace-reports__text-action" onClick={()=>setActiveTab("academics")}>Full analysis <TrendingUp size={14}/></button></div><PerformanceTable rows={filteredResults.slice(0,5)}/></section>
      </div>}
      {activeTab==="attendance"&&<div className="ace-reports__grid ace-reports__attendance-grid"><section className="ace-reports__panel"><div className="ace-reports__section-heading"><div><span className="ace-reports__eyebrow">RECORDED ATTENDANCE</span><h2>Attendance breakdown</h2><p>Totals aggregated from class performance records.</p></div></div><div className="ace-reports__attendance-list">{[["Present",attendance.present,"present"],["Absent",attendance.absent,"absent"],["Late",attendance.late,"late"],["Excused",attendance.excused,"excused"]].map(([label,value,key])=><div key={key}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong><div><i className={`is-${key}`} style={{width:`${attendance.total?value/attendance.total*100:0}%`}}/></div><small>{attendance.total?percent(value/attendance.total*100):"—"}</small></div>)}</div></section><section className="ace-reports__panel"><span className="ace-reports__eyebrow">DATA CONTEXT</span><h2>How to read this report</h2><p className="ace-reports__body-copy">These totals represent attendance entries returned by the current class-performance records. They are not a daily attendance rate or a per-student attendance percentage.</p><div className="ace-reports__note"><CalendarDays size={18}/><span>Use the attendance workspace for taking and correcting daily registers. This area is for analysis of records already saved.</span></div></section></div>}
      {activeTab==="academics"&&<section className="ace-reports__panel"><div className="ace-reports__section-heading ace-reports__section-heading--filter"><div><span className="ace-reports__eyebrow">ACADEMIC OUTCOMES</span><h2>Class performance analysis</h2><p>Compare assessment coverage and class averages.</p></div><label>Filter class<select value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option value="all">All classes</option>{data.setup.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><PerformanceTable rows={filteredResults}/></section>}
    </>}
  </section>
}
function PerformanceTable({rows}){
  return rows.length?<div className="ace-reports__table-wrap"><table className="ace-reports__table"><thead><tr><th>Class</th><th>Students</th><th>Assessments</th><th>Results recorded</th><th>Class average</th></tr></thead><tbody>{rows.map(({schoolClass,performance})=><tr key={schoolClass.id}><td><strong>{schoolClass.name}</strong></td><td>{performance.metrics.studentCount}</td><td>{performance.metrics.assessmentCount}</td><td>{performance.metrics.assessedStudentCount}</td><td><strong className="ace-reports__score">{percent(performance.metrics.classAverage)}</strong></td></tr>)}</tbody></table></div>:<div className="ace-reports__empty">No class performance records are available for this selection.</div>
}
