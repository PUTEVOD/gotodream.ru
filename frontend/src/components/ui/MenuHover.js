// MenuHover.js
export function handleMouseMove(e, id) {
    const hoverEffect = document.getElementById(`hover-${id}`);
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = 50; // Радиус области эффекта, можно настроить

    const x = e.clientX - rect.left - radius;
    const y = e.clientY - rect.top - radius;

    // Ограничиваем область внутри блока
    const maxX = rect.width - radius * 2;
    const maxY = rect.height - radius * 2;

    const clampedX = Math.max(0, Math.min(x, maxX));
    const clampedY = Math.max(0, Math.min(y, maxY));

    hoverEffect.style.left = `${clampedX}px`;
    hoverEffect.style.top = `${clampedY}px`;
    hoverEffect.style.width = `${radius * 2}px`;
    hoverEffect.style.height = `${radius * 2}px`;
}

export function handleMouseLeave(e) {
    const hoverEffect = e.currentTarget.querySelector('.hover-effect');
    hoverEffect.style.display = 'none';
}