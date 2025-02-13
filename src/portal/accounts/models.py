from django.db import models
from django.contrib.auth.models import User
from django.conf import settings


class InvitationToken(models.Model):
    token = models.CharField(max_length=64, unique=True)
    holder = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    # when a user registers an account with this token, the new account will
    # be assigned and hold "addon_cnt" extra tokens for distribution
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

class UserIPLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    ip_address = models.GenericIPAddressField()
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.ip_address} at {self.timestamp}"