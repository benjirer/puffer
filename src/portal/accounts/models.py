from django.db import models
from django.contrib.auth.models import User


class InvitationToken(models.Model):
    token = models.CharField(max_length=64, unique=True)
    holder = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    addon_cnt = models.PositiveIntegerField(default=0)
    shared = models.BooleanField(default=False)

    def __str__(self):
        holder = self.holder.username if self.holder else "unassigned"
        return "%s (%s, %d): shared=%s" % (
            self.token,
            holder,
            self.addon_cnt,
            self.shared,
        )


class UserSession(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.session_key}"
