import { useCallback, useState } from "react"
import DashboardPreview from "../components/common/DashboardPreview"
import Footer from "../components/layout/Footer"
import Header from "../components/layout/Header"
import Button from "../components/ui/Button"
import Modal from "../components/ui/Modal"
import { features, roles, steps } from "../data/siteContent"
import "./HomePage.css"

function SectionIntro({ title, description, centered = false }) {
  return (
    <div
      className={`section-intro ${centered ? "section-intro--centered" : ""}`}
    >
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

function Hero({ onOpenModal }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__content">
        <div>
          <h1 id="hero-title">Smarter School Management</h1>
          <p>
            Keep student records, attendance, teacher management, classes, and
            results in one clean workspace for school administrators and
            teachers.
          </p>
        </div>
        <div className="hero__actions">
          <Button onClick={() => onOpenModal("started")}>Get Started</Button>
          <Button variant="secondary" onClick={() => onOpenModal("demo")}>
            Book a Demo
          </Button>
        </div>
      </div>
      <DashboardPreview />
    </section>
  )
}

function Features() {
  return (
    <section className="content-section features" id="features">
      <SectionIntro
        title="Core Features"
        description="Five core areas to help administrators and teachers manage school tasks."
      />
      <div className="features__grid">
        {features.map(
          ({ title, description, desktopAsset, mobileAsset, Icon }) => (
            <article className="feature-card" key={title}>
              <picture className="feature-card__asset">
                <source media="(max-width: 768px)" srcSet={mobileAsset} />
                <img src={desktopAsset} alt="" aria-hidden="true" />
              </picture>
              <Icon
                className="feature-card__fallback-icon"
                aria-hidden="true"
              />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  )
}

function RoleSupport() {
  return (
    <section className="content-section role-support">
      <SectionIntro
        title="Built for administrators and teachers"
        description="AceEdu supports the people who keep Nigerian schools running every day."
      />
      <div className="role-support__grid">
        {roles.map((role) => (
          <article className="role-card" key={role.title}>
            <div>
              <h3>{role.title}</h3>
              <p>
                <span className="desktop-description">{role.description}</span>
                <span className="mobile-description">
                  {role.mobileDescription || role.description}
                </span>
              </p>
            </div>
            <ul>
              {role.benefits.map((benefit) => (
                <li key={benefit}>
                  <picture>
                    <source
                      media="(max-width: 768px)"
                      srcSet="/assets/60664.svg"
                    />
                    <img src="/assets/61444.svg" alt="" aria-hidden="true" />
                  </picture>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="workflow" id="how-it-works">
      <SectionIntro
        centered
        title="How It Works"
        description="Simple steps to set up your school and start managing daily tasks."
      />
      <ol className="workflow__steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="workflow__number">{index + 1}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function HomePage() {
  const [modalMode, setModalMode] = useState(null)
  const closeModal = useCallback(() => setModalMode(null), [])

  return (
    <>
      <Header onOpenModal={setModalMode} />
      <main>
        <Hero onOpenModal={setModalMode} />
        <section className="school-overview">
          <SectionIntro
            centered
            title="Your School, at a glance"
            description="A clean overview for administrators to review student records, attendance, teachers, classes, and results."
          />
          <DashboardPreview detailed />
        </section>
        <Features />
        <RoleSupport />
        <HowItWorks />
        <section className="final-cta">
          <div>
            <h2>Ready to transform your school?</h2>
            <p>Bring your school records, classes and daily tasks together.</p>
          </div>
          <Button variant="cyan" onClick={() => setModalMode("started")}>
            Get Started
          </Button>
        </section>
      </main>
      <Footer />
      <Modal mode={modalMode} onClose={closeModal} />
    </>
  )
}
