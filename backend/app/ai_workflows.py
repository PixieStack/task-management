import re
from datetime import date
from typing import Any, Optional


PRIORITIES = [
    {"label": "Low", "value": "Low"},
    {"label": "Medium", "value": "Medium"},
    {"label": "High", "value": "High"},
]
WORKFLOW_FIELDS: dict[str, list[dict[str, Any]]] = {
    "task": [
        {"key": "title", "label": "What needs to get done?", "required": True, "input_type": "text", "placeholder": "e.g. Finish the project proposal"},
        {"key": "description", "label": "Anything helpful I should remember?", "required": False, "input_type": "textarea", "placeholder": "Add a little context"},
        {"key": "priority", "label": "How important is it?", "required": True, "input_type": "select", "options": PRIORITIES},
        {"key": "due_date", "label": "Which day is it due?", "required": True, "input_type": "date"},
        {"key": "due_time", "label": "What time is it due?", "required": True, "input_type": "time"},
        {"key": "time_estimate", "label": "How long might it take?", "required": False, "input_type": "number", "min": 0, "max": 10080, "placeholder": "Minutes, e.g. 45"},
        {"key": "tags", "label": "Want to add any tags?", "required": False, "input_type": "text", "placeholder": "e.g. work, report"},
    ],
    "todo": [
        {"key": "title", "label": "What belongs on your list?", "required": True, "input_type": "text", "placeholder": "e.g. Review lecture notes"},
        {"key": "notes", "label": "Anything I should add with it?", "required": False, "input_type": "textarea", "placeholder": "A note or useful context"},
        {"key": "todo_date", "label": "Which day is this for?", "required": True, "input_type": "date"},
        {"key": "priority", "label": "How important is it?", "required": True, "input_type": "select", "options": PRIORITIES},
    ],
    "habit": [
        {"key": "name", "label": "What would you like to repeat?", "required": True, "input_type": "text", "placeholder": "e.g. Walk every morning"},
        {"key": "description", "label": "Why does this matter to you?", "required": False, "input_type": "textarea", "placeholder": "Your motivation, if you want to share it"},
        {"key": "duration_choice", "label": "How long should we build it for?", "required": True, "input_type": "select", "options": [{"label": "21 days", "value": "21"}, {"label": "30 days", "value": "30"}, {"label": "60 days", "value": "60"}, {"label": "90 days", "value": "90"}, {"label": "Custom", "value": "custom"}]},
        {"key": "custom_duration", "label": "How many days feels right?", "required": True, "input_type": "number", "min": 1, "max": 365},
    ],
    "challenge": [
        {"key": "title", "label": "Which book are you reading?", "required": True, "input_type": "text", "placeholder": "e.g. The Hobbit"},
        {"key": "book_type", "label": "Is it fiction or non-fiction?", "required": True, "input_type": "select", "options": [{"label": "Fiction", "value": "fiction"}, {"label": "Non-fiction", "value": "non_fiction"}]},
        {"key": "duration", "label": "How many days do you want?", "required": True, "input_type": "number", "min": 1, "max": 365},
        {"key": "daily_goal", "label": "What feels achievable each day?", "required": True, "input_type": "text", "placeholder": "e.g. 20 pages"},
    ],
    "project": [
        {"key": "title", "label": "What are you working on?", "required": True, "input_type": "text", "placeholder": "e.g. Portfolio redesign"},
        {"key": "description", "label": "What does success look like?", "required": True, "input_type": "textarea", "placeholder": "Describe the outcome you want"},
        {"key": "category", "label": "Where should I organise it?", "required": True, "input_type": "select", "dynamic": "project_categories"},
    ],
}


def detect_workflow(message: str) -> Optional[str]:
    text = " ".join(message.lower().split())
    if not re.search(r"\b(create|add|make|new|set up|start|track)\b", text):
        return None
    if "pomodoro" in text or "focus timer" in text or "standalone timer" in text or re.search(r"\b(timer|timing|track time)\b", text):
        return None
    if re.search(r"\b(project)\b", text):
        return "project"
    if re.search(r"\b(reading|challenge|reading plan)\b", text):
        return "challenge"
    if re.search(r"\b(habit)\b", text):
        return "habit"
    if re.search(r"\b(todo|to-do)\b", text):
        return "todo"
    if re.search(r"\b(task)\b", text):
        return "task"
    return None


def start_workflow(kind: str) -> dict[str, Any]:
    return {"type": kind, "values": {}, "active": True}


def _field_is_relevant(field: dict[str, Any], workflow: dict[str, Any]) -> bool:
    values = workflow["values"]
    if field["key"] == "custom_duration" and values.get("duration_choice") != "custom":
        return False
    return True


WORKFLOW_TITLES = {
    "task": ("Create a task", "Share the essentials and I’ll add it to your workspace."),
    "todo": ("Add a Todo", "Tell me what belongs on your list."),
    "habit": ("Build a habit", "Choose the routine and a pace that feels realistic."),
    "challenge": ("Start a reading challenge", "Tell me about the book and your reading rhythm."),
    "project": ("Create a project", "Give me the outcome and where it belongs."),
}


def _resolved_field(field: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    prompt = {key: value for key, value in field.items() if key != "dynamic"}
    if field.get("dynamic") == "project_categories":
        names = ["Software Development", "Marketing", "Design", "Research", "Operations"]
        names.extend(item["name"] for item in context.get("project_categories", []))
        prompt["options"] = [{"label": name, "value": name} for name in dict.fromkeys(names)]
        prompt["allow_custom"] = True
    if field["key"] == "custom_duration":
        prompt.update({"depends_on": "duration_choice", "show_when": "custom"})
    if field["key"] == "due_time":
        prompt["depends_on"] = "due_date"
    return prompt


def form_prompt(workflow: dict[str, Any], context: dict[str, Any], errors: Optional[dict[str, str]] = None) -> dict[str, Any]:
    title, description = WORKFLOW_TITLES[workflow["type"]]
    return {
        "workflow_type": workflow["type"],
        "title": title,
        "description": description,
        "fields": [_resolved_field(field, context) for field in WORKFLOW_FIELDS[workflow["type"]]],
        "values": workflow.get("values", {}),
        "errors": errors or {},
    }


def accept_values(workflow: dict[str, Any], submitted: dict[str, Any], context: dict[str, Any]) -> tuple[bool, dict[str, str]]:
    values = {**workflow.get("values", {}), **submitted}
    errors: dict[str, str] = {}
    workflow["values"] = values
    for field in WORKFLOW_FIELDS[workflow["type"]]:
        if not _field_is_relevant(field, workflow):
            values.pop(field["key"], None)
            continue
        raw_value = values.get(field["key"])
        value = str(raw_value).strip() if raw_value is not None else ""
        if not value and field["required"]:
            errors[field["key"]] = "Please answer this before I continue."
            continue
        if not value:
            values[field["key"]] = None
            continue
        if field["input_type"] == "select":
            resolved = _resolved_field(field, context)
            options = resolved.get("options", [])
            if resolved.get("depends_on"):
                dependency = str(values.get(resolved["depends_on"], ""))
                options = [option for option in options if not option.get("when") or option.get("when") == dependency]
            allowed = {str(option["value"]) for option in options}
            if value not in allowed and field.get("dynamic") != "project_categories":
                errors[field["key"]] = "Choose one of these options."
                continue
        if field["input_type"] == "date":
            try:
                date.fromisoformat(value)
            except ValueError:
                errors[field["key"]] = "Choose a valid date."
                continue
        if field["input_type"] == "time" and not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
            errors[field["key"]] = "Choose a valid time."
            continue
        if field["input_type"] == "number":
            try:
                number = int(value)
            except ValueError:
                errors[field["key"]] = "Enter a whole number."
                continue
            if number < field.get("min", number) or number > field.get("max", number):
                errors[field["key"]] = f"Choose a number from {field.get('min')} to {field.get('max')}."
                continue
            values[field["key"]] = number
        else:
            values[field["key"]] = value
    workflow["values"] = values
    return not errors, errors


def build_action(workflow: dict[str, Any]) -> dict[str, Any]:
    kind = workflow["type"]
    values = workflow["values"]
    if kind == "task":
        due_date = values.get("due_date")
        if due_date and values.get("due_time"):
            due_date = f"{due_date}T{values['due_time']}:00"
        return {"type": "create_task", "title": values["title"], "description": values.get("description") or "", "status": "Not Started", "priority": values["priority"], "due_date": due_date, "time_estimate": values.get("time_estimate") or 0, "tags": [tag.strip() for tag in (values.get("tags") or "").split(",") if tag.strip()]}
    if kind == "todo":
        return {"type": "create_todo", "title": values["title"], "notes": values.get("notes") or "", "todo_date": values["todo_date"], "priority": values["priority"], "completed": False}
    if kind == "habit":
        duration = values.get("custom_duration") if values.get("duration_choice") == "custom" else values["duration_choice"]
        return {"type": "create_habit", "name": values["name"], "description": values.get("description") or "", "duration_days": int(duration)}
    if kind == "challenge":
        return {"type": "create_challenge", "challenge_type": "reading", "title": values["title"], "book_type": values["book_type"], "duration": values["duration"], "daily_goal": values["daily_goal"]}
    if kind == "project":
        return {"type": "create_project", "title": values["title"], "description": values.get("description") or "", "category": values["category"]}
    raise ValueError(f"Unsupported creation workflow: {kind}")
