import { useState, useEffect } from "react";
import { t, type TranslationKey } from "../../i18n";
import type { SnacodeDesktopApi } from "../../../../preload";
import { type Task, type TaskStatus } from "../../../../shared/algs";

declare global {
	interface Window {
		snacodeDesktop: SnacodeDesktopApi;
	}
}
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { TextField } from "../ui/TextField";
import { SelectField } from "../ui/SelectField";
import { Clock, Play, CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

const STATUS_COLORS: Record<TaskStatus, string> = {
	pending: "status-pending",
	running: "status-running",
	completed: "status-completed",
	failed: "status-failed",
	cancelled: "status-cancelled",
};

export function AlgsTaskPanel() {
	const ipc = window.snacodeDesktop;
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [openModal, setOpenModal] = useState(false);
	const [selectedCard, setSelectedCard] = useState<string>("");
	const [taskInput, setTaskInput] = useState("");
	const [cards, setCards] = useState<{ value: string; label: string }[]>([]);

	useEffect(() => {
		void loadTasks();
		void loadCards();
	}, []);

	const loadTasks = async () => {
		setLoading(true);
		try {
			const result = await ipc.algs.getTasks();
			setTasks(result);
		} catch (error) {
			console.error("Failed to load tasks:", error);
		}
		setLoading(false);
	};

	const loadCards = async () => {
		try {
			const result = await ipc.algs.getSkillCards();
			setCards(result.map((c: any) => ({ value: c.id, label: c.name })));
		} catch (error) {
			console.error("Failed to load cards:", error);
		}
	};

	const handleSubmitTask = async () => {
		if (!taskInput || !selectedCard) return;

		try {
			await ipc.algs.submitTask({
				input: taskInput,
				skillCardId: selectedCard,
			});
			setOpenModal(false);
			setTaskInput("");
			setSelectedCard("");
			void loadTasks();
		} catch (error) {
			console.error("Failed to submit task:", error);
		}
	};

	const getStatusIcon = (status: TaskStatus) => {
		switch (status) {
			case "completed":
				return <CheckCircle className="status-icon status-icon-success" aria-hidden="true" />;
			case "failed":
				return <XCircle className="status-icon status-icon-error" aria-hidden="true" />;
			case "running":
				return <Loader2 className="status-icon status-icon-running" aria-hidden="true" />;
			default:
				return <Clock className="status-icon status-icon-pending" aria-hidden="true" />;
		}
	};

	const getStatusLabel = (status: TaskStatus): TranslationKey => {
		const keys: Record<TaskStatus, TranslationKey> = {
			pending: "algs.status.pending",
			running: "algs.status.running",
			completed: "algs.status.completed",
			failed: "algs.status.failed",
			cancelled: "algs.status.cancelled",
		};
		return keys[status];
	};

	return (
		<div className="algs-panel">
			<div className="algs-panel-header">
				<h3 className="algs-panel-title">
					<Clock className="algs-panel-icon" aria-hidden="true" />
					{t("algs.tasks")}
				</h3>
				<Button variant="primary" buttonSize="sm" onClick={() => setOpenModal(true)}>
					<Play className="inline-icon" aria-hidden="true" />
					{t("algs.newTask")}
				</Button>
			</div>

			<div className="algs-panel-content">
				{loading ? (
					<div className="config-loading">{t("common.loading")}</div>
				) : tasks.length === 0 ? (
					<div className="config-empty">
						<Clock className="empty-icon" aria-hidden="true" />
						<p>{t("algs.noTasks")}</p>
						<Button variant="ghost" onClick={() => setOpenModal(true)}>
							{t("algs.createFirstTask")}
						</Button>
					</div>
				) : (
					<div className="task-list">
						{tasks.map((task) => (
							<div key={task.id} className="task-item">
								<div className="task-status">
									{getStatusIcon(task.status)}
									<span className={`status-label ${STATUS_COLORS[task.status]}`}>
										{t(getStatusLabel(task.status))}
									</span>
								</div>
								<div className="task-info">
									<div className="task-header">
										<span className="task-input">{task.input}</span>
									</div>
									<div className="task-meta">
										<span className="task-card">
											<FileText className="inline-icon-sm" aria-hidden="true" />
											{cards.find((c) => c.value === task.skillCardId)?.label || task.skillCardId}
										</span>
										<span className="task-date">{new Date(task.createdAt).toLocaleString()}</span>
									</div>
									{task.output && (
										<div className="task-output">
											<p>{task.output}</p>
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			<Modal open={openModal} onClose={() => setOpenModal(false)} title={t("algs.newTask")}>
				<div className="algs-form">
					<SelectField
						label={t("algs.selectSkillCard")}
						value={selectedCard}
						options={cards}
						onChange={(value) => setSelectedCard(value)}
					/>

					<TextField
						label={t("algs.taskInput")}
						value={taskInput}
						onChange={(value) => setTaskInput(value)}
						placeholder={t("algs.taskInputPlaceholder")}
					/>

					<div className="algs-form-actions">
						<Button variant="ghost" onClick={() => setOpenModal(false)}>
							{t("common.cancel")}
						</Button>
						<Button variant="primary" onClick={handleSubmitTask} disabled={!taskInput || !selectedCard}>
							{t("algs.submitTask")}
						</Button>
					</div>
				</div>
			</Modal>
		</div>
	);
}
