import { activities, metrics } from "../../data/siteContent"
import "./DashboardPreview.css"

export default function DashboardPreview({ detailed = false }) {
  return (
    <article className={`dashboard ${detailed ? "dashboard--detailed" : ""}`}>
      <header className="dashboard__header">
        <div className="dashboard__toolbar">
          <div>
            <h3>Admin Dashboard</h3>
            <p className="dashboard__school">Sample School, Lagos</p>
            <p>
              {detailed
                ? "Sample School, Lagos — illustrative sample data"
                : "Illustrative sample data"}
            </p>
          </div>
          <span>Today</span>
        </div>
      </header>
      <div className="dashboard__body">
        <div className="dashboard__metrics">
          {metrics.map((metric) => (
            <div className="dashboard__metric" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
        <div className="dashboard__activity">
          <h4>Recent Activity{detailed ? " — sample entries" : ""}</h4>
          {activities.map((activity) => (
            <div key={activity}>
              <picture>
                <source media="(max-width: 768px)" srcSet="/assets/f3daa.svg" />
                <img
                  src={detailed ? "/assets/f9218.svg" : "/assets/fa1ac.svg"}
                  alt=""
                  aria-hidden="true"
                />
              </picture>
              <p>{activity}</p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}
