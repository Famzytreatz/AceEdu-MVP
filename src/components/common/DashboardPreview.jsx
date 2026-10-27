import { useEffect, useId, useRef } from "react"
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  LayoutDashboard,
  Users,
} from "lucide-react"
import { activities, metrics } from "../../data/siteContent"
import "./DashboardPreview.css"

const metricIcons = [GraduationCap, Users, BookOpen]
const metricTrends = ["+8.2%", "+2 new", ""]
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const chartPoints = "0,76 48,58 96,66 144,35 192,47 240,23 288,31"

export default function DashboardPreview({ detailed = false }) {
  const chartFillId = `dashboard-chart-fill-${useId().replaceAll(":", "")}`
  const insightsRef = useRef(null)

  useEffect(() => {
    const insights = insightsRef.current
    if (!insights) return

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      insights.classList.add("is-visible")
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        insights.classList.add("is-visible")
        observer.unobserve(insights)
      },
      { threshold: 0.25 },
    )

    observer.observe(insights)
    return () => observer.disconnect()
  }, [])

  return (
    <article
      className={`dashboard ${detailed ? "dashboard--detailed" : ""}`}
      aria-label="Illustrative AceEdu admin dashboard"
    >
      <header className="dashboard__header">
        <div className="dashboard__brand">
          <span className="dashboard__brand-mark" aria-hidden="true">
            <GraduationCap size={19} />
          </span>
          <div>
            <h3>AceEdu</h3>
            <p>Sample School, Lagos</p>
          </div>
        </div>
        <div className="dashboard__header-actions">
          <span className="dashboard__sample-badge">
            <span aria-hidden="true" />
            SAMPLE DATA
          </span>
          <span className="dashboard__date">
            <CalendarDays size={14} aria-hidden="true" />
            Today
          </span>
        </div>
      </header>

      <div className="dashboard__workspace">
        <nav className="dashboard__rail" aria-label="Illustrative dashboard navigation">
          <span className="dashboard__rail-item is-active" aria-label="Overview">
            <LayoutDashboard size={17} aria-hidden="true" />
          </span>
          <span className="dashboard__rail-item" aria-label="Students">
            <GraduationCap size={17} aria-hidden="true" />
          </span>
          <span className="dashboard__rail-item" aria-label="Staff">
            <Users size={17} aria-hidden="true" />
          </span>
          <span className="dashboard__rail-item" aria-label="Classes">
            <BookOpen size={17} aria-hidden="true" />
          </span>
        </nav>

        <div className="dashboard__main">
          <div className="dashboard__intro">
            <div>
              <p className="dashboard__eyebrow">SCHOOL OVERVIEW</p>
              <h4>Your school at a glance</h4>
            </div>
            <span className="dashboard__period">This week <span aria-hidden="true">⌄</span></span>
          </div>

          <div className="dashboard__metrics">
            {metrics.map((metric, index) => {
              const MetricIcon = metricIcons[index]
              return (
                <div className="dashboard__metric" key={metric.label}>
                  <div className="dashboard__metric-heading">
                    <span className="dashboard__metric-icon" aria-hidden="true">
                      <MetricIcon size={15} />
                    </span>
                    {metricTrends[index] && (
                      <span className="dashboard__metric-trend">
                        {index === 0 && <ArrowUpRight size={12} aria-hidden="true" />}
                        {metricTrends[index]}
                      </span>
                    )}
                  </div>
                  <strong>{metric.value}</strong>
                  <p>{metric.label}</p>
                </div>
              )
            })}
          </div>

          <div className="dashboard__insights" ref={insightsRef}>
            <section className="dashboard__chart-card" aria-label="Weekly school activity chart">
              <div className="dashboard__section-heading">
                <div>
                  <h4>School activity</h4>
                  <p>Weekly engagement overview</p>
                </div>
                <span className="dashboard__chart-key"><i aria-hidden="true" /> Activity</span>
              </div>
              <div className="dashboard__chart">
                <div className="dashboard__chart-y-labels" aria-hidden="true">
                  <span>100</span>
                  <span>75</span>
                  <span>50</span>
                  <span>25</span>
                </div>
                <svg
                  viewBox="0 0 288 100"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Illustrative school activity increased through the week"
                >
                  <defs>
                    <linearGradient id={chartFillId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#52d8ee" stopOpacity=".28" />
                      <stop offset="100%" stopColor="#52d8ee" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="dashboard__chart-area"
                    style={{ fill: `url(#${chartFillId})` }}
                    d={`M ${chartPoints.replaceAll(" ", " L ")} L 288 100 L 0 100 Z`}
                  />
                  <polyline className="dashboard__chart-line" points={chartPoints} />
                  {[0, 1, 2, 3, 4, 5, 6].map((point) => (
                    <circle
                      className="dashboard__chart-point"
                      key={weekDays[point]}
                      cx={point * 48}
                      cy={Number(chartPoints.split(" ")[point].split(",")[1])}
                      r="3"
                    />
                  ))}
                </svg>
                <div className="dashboard__chart-x-labels" aria-hidden="true">
                  {weekDays.map((day) => <span key={day}>{day}</span>)}
                </div>
              </div>
            </section>

            <section className="dashboard__attendance">
              <div className="dashboard__section-heading">
                <div>
                  <h4>Attendance</h4>
                  <p>Today's snapshot</p>
                </div>
                <Activity size={16} aria-hidden="true" />
              </div>
              <div className="dashboard__attendance-ring" role="img" aria-label="Illustrative attendance rate: 96 percent">
                <div>
                  <strong>96%</strong>
                  <span>Present</span>
                </div>
              </div>
              <div className="dashboard__attendance-note">
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>Looking good today</span>
              </div>
            </section>
          </div>

          <section className="dashboard__activity">
            <div className="dashboard__section-heading">
              <div>
                <h4>Recent activity</h4>
                <p>Latest updates from your school</p>
              </div>
              <span className="dashboard__activity-link">View all <ArrowUpRight size={13} aria-hidden="true" /></span>
            </div>
            <div className="dashboard__activity-list">
              {activities.map((activity, index) => (
                <div className="dashboard__activity-item" key={activity}>
                  <span className={`dashboard__activity-icon dashboard__activity-icon--${index}`} aria-hidden="true">
                    {index === 0 ? <CheckCircle2 size={15} /> : <GraduationCap size={15} />}
                  </span>
                  <p>{activity}</p>
                  <span className="dashboard__activity-time">{index === 0 ? "9:42 AM" : "Yesterday"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </article>
  )
}
