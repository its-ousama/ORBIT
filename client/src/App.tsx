import { useState } from "react";
import dayjs from "dayjs";
import TasksPage from "./components/TasksPage";
import CalendarPage from "./components/CalendarPage";
import DocumentationPage from "./components/DocumentationPage";
import BoardsPage from "./components/BoardsPage";
import WeekPage from "./components/WeekPage";
import JournalPage from "./components/JournalPage";
import FinancePage from "./components/FinancePage";
import HomePage from "./components/HomePage";
import HomeButton from "./components/HomeButton";
import "./App.css";

export type Page = "home" | "tasks" | "calendar" | "documentation" | "boards" | "week" | "journal" | "finance";

export default function App() {
  const [selectedDate, setSelectedDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [page, setPage] = useState<Page>("home");

  const goToDay = (date: string) => {
    setSelectedDate(date);
    setPage("tasks");
  };

  const goHome = () => setPage("home");

  if (page === "home") {
    return <HomePage onNavigate={setPage} />;
  }

  return (
    <div className="app-fullscreen" key={page}>
      <HomeButton onHome={goHome} />
      {page === "tasks" && <TasksPage selectedDate={selectedDate} onDateChange={setSelectedDate} />}
      {page === "calendar" && <CalendarPage onGoToDay={goToDay} />}
      {page === "documentation" && <DocumentationPage />}
      {page === "boards" && <BoardsPage />}
      {page === "week" && <WeekPage />}
      {page === "journal" && <JournalPage />}
      {page === "finance" && <FinancePage />}
    </div>
  );
}