export class Entity {
    constructor(type, x, y, stateWidth) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.radius = stateWidth * 0.03; // Responsive size = 21.6
        this.vx = (Math.random() * 2 - 1) * (stateWidth * 0.15);
        this.vy = (Math.random() * 2 - 1) * (stateWidth * 0.15);
        this.captureEffect = 0;
        this.beingCaptured = false;
    }

    update(state, deltaTime, simulationSpeed) {
        // Don't update if we're still in countdown
        if (state.countdown > 0) {
            return;
        }

        // Apply simulation speed multiplier
        const adjustedDeltaTime = deltaTime * simulationSpeed;

        // Move based on velocity
        this.x += this.vx * adjustedDeltaTime;
        this.y += this.vy * adjustedDeltaTime;

        // Wall collisions
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx = -this.vx;
        } else if (this.x + this.radius > state.width) {
            this.x = state.width - this.radius;
            this.vx = -this.vx;
        }

        if (this.y - this.radius < 0) {
            this.y = this.radius;
            this.vy = -this.vy;
        } else if (this.y + this.radius > state.height) {
            this.y = state.height - this.radius;
            this.vy = -this.vy;
        }

        // Update capture effect (fade out) - increased fade speed
        if (this.captureEffect > 0) {
            this.captureEffect -= adjustedDeltaTime * 4;
            if (this.captureEffect < 0) {
                this.captureEffect = 0;
                // Reset the being captured flag
                this.beingCaptured = false;
                // Remove from the capturing entities set
                state.capturingEntities.delete(this);
            }
        }
    }

    collidesWith(other) {
        // Don't check collisions if we're still in countdown
        if (this.beingCaptured || other.beingCaptured) {
            return false;
        }

        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < this.radius + other.radius;
    }

    resolveCollision(other) {
        // Calculate collision normal
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Normal vector (points from this entity to the other entity)
        const nx = dx / distance;
        const ny = dy / distance;

        // Calculate dot product of velocity and normal (projection of velocity onto normal)
        const dotProductThis = this.vx * nx + this.vy * ny;
        const dotProductOther = other.vx * nx + other.vy * ny;

        // Reflect velocities based on the normal vector
        // Formula: v' = v - 2(v·n)n
        this.vx = this.vx - 2 * (dotProductThis * nx);
        this.vy = this.vy - 2 * (dotProductThis * ny);
        other.vx = other.vx - 2 * (dotProductOther * nx);
        other.vy = other.vy - 2 * (dotProductOther * ny);

        // Separate objects to prevent overlap
        const overlap = this.radius + other.radius - distance;
        if (overlap > 0) {
            this.x -= (overlap / 2) * nx;
            this.y -= (overlap / 2) * ny;
            other.x += (overlap / 2) * nx;
            other.y += (overlap / 2) * ny;
        }
    }

    capture(state, newType) {
        // Don't allow already captured entities to be captured again
        if (this.beingCaptured || state.capturingEntities.has(this)) {
            return;
        }

        // Reduce count for old type
        state.teamCounts[this.type]--;

        // Update type
        this.type = newType;

        // Increase count for new type
        state.teamCounts[newType]++;

        // Add capture effect - set to maximum strength
        this.captureEffect = 1.0;
        this.beingCaptured = true;
        state.capturingEntities.add(this);

        // Add capture animation
        state.captureAnimations = state.captureAnimations.filter(anim => anim.entity !== this);
        state.captureAnimations.push({
            x: this.x,
            y: this.y,
            radius: this.radius,
            time: 1.0,
            entity: this
        });
    }
}
